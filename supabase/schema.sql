-- Supabase SQL Editor에서 한 번 실행하세요.
create table if not exists positions (
  id uuid primary key default gen_random_uuid(),

  -- "actual"(실제 포지션) | "statement"(예측 발언)
  type text not null default 'actual' check (type in ('actual', 'statement')),

  -- 생성 시 한 번만 입력, 이후 수정 안 함
  trader_name text not null,

  -- 관리자가 직접 입력/수정
  trader_image text,

  -- 실제 포지션 전용 (type = 'actual')
  symbol text,
  leverage numeric,
  quantity numeric, -- 수량(기초자산 개수, 예: BTC 수량)
  entry_price numeric, -- USDT
  liquidation_price numeric, -- USDT

  -- 예측 발언 전용 (type = 'statement')
  quote text,

  -- 공통: 실제 포지션의 방향 / 예측 발언의 예상 방향
  direction text not null check (direction in ('Long', 'Short')),

  -- 결과: 수정 폼 안에서 다른 필드와 함께 저장된다
  result text check (result in ('win', 'draw', 'loss')),
  result_note text,
  result_pnl_percent numeric, -- "지금 시세로 자동 계산" 버튼 사용 시 자동 기록
  result_recorded_at timestamptz,

  -- 자동 기록 (pnl/수익률은 저장하지 않고 entry_price·direction·leverage·quantity +
  -- 실시간 mark_price로 그때그때 계산)
  created_at timestamptz not null default now()
);

-- 서버(Service Role Key)에서만 접근하고 브라우저에서 직접 호출하지 않으므로 RLS는 잠가둡니다.
alter table positions enable row level security;

-- Vercel 무료 플랜은 런타임 로그를 오래 안 남겨서, 외부 API 실패/관리자 작업 같은
-- 의미 있는 이벤트를 여기 직접 기록한다.
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('error', 'info')),
  source text not null, -- 'bybit' | 'bithumb' | 'yahoo_finance' | 'alternative_me' | 'admin'
  message text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table logs enable row level security;

-- "랭커" 페이지: 지갑 주소만 등록해두면 포지션 데이터는 하이퍼리퀴드 공개 API로 실시간 조회한다.
create table if not exists rankers (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  note text, -- 예: "26.09.19 기준 하이퍼리퀴드 PNL 리더보드 3위"
  created_at timestamptz not null default now()
);

alter table rankers enable row level security;

-- 실시간 접속자 수 표시용. 브라우저가 주기적으로 핑을 보내 자기 세션을 갱신하고,
-- 최근 20초 안에 핑이 온 행 개수를 "현재 접속자 수"로 센다.
create table if not exists presence (
  session_id text primary key,
  last_seen timestamptz not null default now()
);

alter table presence enable row level security;

-- 운영자 포지션 페이지: Bybit은 6개월치 데이터만 보관하므로, 잔액 그래프를 위해
-- 주기적으로(6시간마다, GitHub Actions cron) 스냅샷을 직접 쌓아 영구 보관한다.
create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  total_equity numeric not null,
  recorded_at timestamptz not null default now()
);

alter table balance_snapshots enable row level security;

-- 운영자 포지션 페이지: Bybit 입출금 내역도 6개월 지나면 사라지므로 영구 보관한다.
create table if not exists cash_flows (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('deposit', 'withdraw')),
  coin text not null,
  amount numeric not null,
  tx_id text not null unique,
  occurred_at timestamptz not null
);

alter table cash_flows enable row level security;

-- 주인장 포지션 페이지: 승률 계산용. closed-pnl API는 한 번에 최대 7일치만 조회되므로
-- 영구 저장해두고 우리 DB에서 집계한다.
create table if not exists closed_trades (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  closed_pnl numeric not null,
  order_id text not null unique,
  closed_at timestamptz not null
);
-- 방향성까지 추적
alter table closed_trades enable row level security;
alter table closed_trades add column if not exists direction text check (direction in ('Long', 'Short'));

-- 같은 포지션의 부분청산들을 묶어 승/패를 계산하기 위한 그룹핑 키 (symbol + avg_entry_price)
alter table closed_trades add column if not exists avg_entry_price numeric;

-- 승/무/패 판정용: 포지션 손익 ÷ 증거금(진입 금액 ÷ 레버리지)이 -3%~+3%면 무승부
alter table closed_trades add column if not exists entry_value numeric; -- Bybit cumEntryValue (USDT)
alter table closed_trades add column if not exists leverage numeric;

-- ===== AI 투자자 (TODO 19) =====
-- GitHub Actions(.github/workflows/ai-investors.yml)가 매일 원본 데이터를 받아 쌓고,
-- AI별 매매를 2026-03-06부터 처음부터 다시 계산해서 결과 테이블(ai_trades·ai_holdings·ai_equity_daily)을 통째로 바꾼다.
-- 원본 데이터는 출처에서 나중에 사라질 수 있어서(상장폐지 종목의 야후 시세, SEC 티커 목록 등) 받은 건 계속 보관한다.

-- 종가·배당 (야후). 배당은 배당락일 기준 주당 금액.
create table if not exists ai_prices (
  symbol text not null,
  date date not null, -- 거래소 현지 날짜
  close numeric not null,
  dividend numeric not null default 0,
  primary key (symbol, date)
);

alter table ai_prices enable row level security;

-- 액면분할·분사 가격 조정 (야후). SEC 주식수를 야후 가격 단위에 맞추는 데 쓴다.
create table if not exists ai_splits (
  symbol text not null,
  date date not null,
  ratio numeric not null, -- 10:1 분할이면 10
  primary key (symbol, date)
);

alter table ai_splits enable row level security;

-- S&P500 구성 종목 (위키백과). 기간 중 편입·편출을 기록해 그 날짜의 실제 구성 종목으로 계산한다(생존 편향 방지).
create table if not exists ai_universe (
  symbol text primary key, -- 야후 형식 (BRK.B → BRK-B)
  cik text not null, -- SEC 회사 번호 10자리
  sector text not null default '', -- 편출 종목은 위키백과에 업종이 없어서 빈 값
  added_on date, -- null이면 2026-03-06 전부터 구성 종목
  removed_on date -- null이면 아직 구성 종목
);

alter table ai_universe enable row level security;

-- SEC EDGAR 재무 (필요한 항목만). filed(공시일)로 "그 시점에 알 수 있던 값"만 골라 쓴다.
-- 같은 값이 여러 공시에 반복되면 가장 먼저 공시된 것 하나만 남긴다.
create table if not exists ai_fundamentals (
  id bigint generated always as identity primary key,
  cik text not null,
  tag text not null, -- us-gaap 항목 이름 (표지 주식수만 dei:EntityCommonStockSharesOutstanding)
  period_start date, -- 기간 값(매출 등)만 있음. 시점 값(자본·주식수 등)은 null
  period_end date not null,
  value numeric not null,
  filed date not null,
  form text not null -- '10-K' | '10-Q'
);

create index if not exists ai_fundamentals_cik_idx on ai_fundamentals (cik);
alter table ai_fundamentals enable row level security;

-- 결과: AI별 매매 기록. 주식은 그날 종가, AI 호반꿀은 박호두 진입·종료 가격으로 체결.
create table if not exists ai_trades (
  id bigint generated always as identity primary key,
  ai text not null, -- 'wallstreet' | 'korean_ant' | 'fear_greed' | 'buffett' | 'burry' | 'hobanhoney' | 'wonyotti'
  traded_at timestamptz not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell', 'short', 'cover')),
  quantity numeric not null, -- 항상 양수, 방향은 side
  price numeric not null, -- 그 종목의 거래 통화 (한국 ETF는 원, 나머지는 USD)
  leverage numeric, -- AI 호반꿀만
  reason text not null
);

create index if not exists ai_trades_ai_idx on ai_trades (ai, traded_at);
alter table ai_trades enable row level security;

-- 결과: AI별 현재 보유 종목. 숏은 quantity가 음수.
create table if not exists ai_holdings (
  id bigint generated always as identity primary key,
  ai text not null,
  symbol text not null,
  quantity numeric not null,
  avg_price numeric not null, -- 거래 통화
  leverage numeric, -- AI 호반꿀만
  opened_at timestamptz not null,
  value numeric not null -- 마지막 계산 시점 평가액 (USD). 호반꿀은 증거금 + 미실현 손익
);

create index if not exists ai_holdings_ai_idx on ai_holdings (ai);

alter table ai_holdings enable row level security;

-- 결과: AI별 일별 자산. 월별 성과(시드 = 월초 자산 + 그 달 입금)와 자산 그래프에 쓴다.
create table if not exists ai_equity_daily (
  ai text not null,
  date date not null,
  cash numeric not null,
  equity numeric not null, -- 현금 + 보유 평가액 (USD)
  invested numeric not null, -- 누적 입금 (USD)
  withdrawn numeric not null default 0, -- 누적 출금 (USD). AI 워뇨띠만 출금함
  primary key (ai, date)
);

alter table ai_equity_daily enable row level security;
-- 2026-10-11 추가 (이미 만든 테이블용)
alter table ai_equity_daily add column if not exists withdrawn numeric not null default 0;

-- 운영자 매매원칙·전략. 관리자 페이지 "운영자 매매원칙 및 전략"(/admin/principles)에서 직접 추가·수정·삭제한다.
-- 화면에는 created_at 순서대로 번호를 매겨 보여준다 (수정해도 순서는 그대로).
create table if not exists founder_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('principle', 'strategy')), -- 매매원칙 | 전략
  content text not null,
  created_at timestamptz not null default now()
);

alter table founder_notes enable row level security;

-- 2026-10-17: /founder 페이지 코드에 적혀 있던 매매원칙 4개를 옮겨 넣는다. 순서를 지키려고 시각을 1초씩 띄운다.
insert into founder_notes (kind, content, created_at)
select * from (values
  ('principle', '욕심을 절제하고, 손절은 짧고 익절은 긴 근거가 많은 자리만 반드시 기다려서 진입한다 (손익비 2 이상)', timestamptz '2026-10-17 00:00:01+09'),
  ('principle', '분할 매수, 분할 매도는 신이다.', timestamptz '2026-10-17 00:00:02+09'),
  ('principle', 'SL만큼은 절대 건드리지 말 것', timestamptz '2026-10-17 00:00:03+09'),
  ('principle', '반드시 매매일지를 작성한다.', timestamptz '2026-10-17 00:00:04+09')
) as seed(kind, content, created_at)
where not exists (select 1 from founder_notes);

-- 운영자 매매일지. 관리자 페이지 "매매일지"(/admin/journal)를 열 때와 6시간 자동 수집(/api/founder-snapshot) 때
-- Bybit 열린 포지션과 맞춰서, 새 포지션은 자동으로 항목을 만들고 사라진 포지션은 종료로 표시한다.
-- 진입·종료 근거만 운영자가 직접 쓴다. 두 동기화 사이에 열었다 닫은 짧은 포지션은 잡히지 않는다.
create table if not exists trade_journal (
  id uuid primary key default gen_random_uuid(),
  symbol text not null, -- Bybit 형식 "BTCUSDT"
  direction text not null check (direction in ('Long', 'Short')),
  position_value numeric not null, -- 비중(USDT). 열려 있는 동안 동기화마다 최신 값으로 갱신 (분할 매수 반영)
  opened_at timestamptz not null, -- Bybit 포지션 진입 시각
  closed_at timestamptz, -- 포지션이 사라진 걸 확인한 동기화 시각. null이면 진행 중
  entry_reason text,
  exit_reason text,
  created_at timestamptz not null default now()
);

-- 같은 종목·방향의 진행 중 항목은 하나뿐이어야 한다 (동기화가 겹쳐도 중복 생성 방지).
create unique index if not exists trade_journal_open_idx
  on trade_journal (symbol, direction) where closed_at is null;

alter table trade_journal enable row level security;

-- 지갑 추적 트레이더(제프리황 등)의 포지션 기록. 하이퍼리퀴드 체결 기록을 "진입 → 완전 종료" 1건으로 묶어 저장한다.
-- scripts/wallet-traders가 매일(GitHub Actions ai-investors 워크플로) 이어서 처리한다.
create table if not exists wallet_trades (
  id uuid primary key default gen_random_uuid(),
  trader_name text not null,
  coin text not null, -- 하이퍼리퀴드 종목 이름 ("ETH")
  direction text not null check (direction in ('Long', 'Short')),
  entry_price numeric not null, -- 진입 체결들의 가중평균가
  max_size numeric not null, -- 포지션이 가장 컸을 때 수량
  leverage numeric not null, -- 종목별 현재 레버리지 설정 (과거 설정은 API로 알 수 없어 근사)
  pnl numeric not null, -- 실현손익 − 수수료 (USDC)
  result_pnl_percent numeric not null, -- pnl ÷ 증거금(최대 수량 × 평균 진입가 ÷ 레버리지) × 100
  result text not null check (result in ('win', 'draw', 'loss')), -- ±3% 기준 (유튜버와 같음)
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  unique (trader_name, opened_at, coin)
);

create index if not exists wallet_trades_trader_idx on wallet_trades (trader_name, closed_at);
alter table wallet_trades enable row level security;

-- 지갑 추적 이어서 하기용 상태. 체결이 하루 1만 건 넘게 나와서 매번 처음부터 받지 않고 마지막 처리 시점부터 받는다.
create table if not exists wallet_sync (
  trader_name text primary key,
  synced_until bigint not null, -- 마지막으로 처리한 체결 시각 (ms)
  open_positions jsonb not null default '{}' -- 아직 안 닫힌 포지션의 진행 상태 (종목 → 상태)
);

alter table wallet_sync enable row level security;

-- 바이낸스 선물 OI 급증 알림 (scripts/oi-alerts). 알림(alert)마다 같은 시각 무작위 비교 종목(control)을 같이 기록해서,
-- 72시간 뒤 결과를 비교해 "OI 급증이 펌핑을 앞서는지" 검증한다.
create table if not exists oi_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null, -- 바이낸스 종목 ("IRYSUSDT")
  kind text not null check (kind in ('alert', 'control')),
  alerted_at timestamptz not null, -- OI 기록 시각 (정시)
  oi_usd numeric not null,
  oi_change_4h numeric not null, -- 비율 (0.3 = +30%)
  price numeric not null,
  price_change_4h numeric not null, -- 비율
  funding_rate numeric, -- 기록할 때의 직전 펀딩비
  price_24h numeric, -- 아래 셋은 72시간 지난 뒤 채움
  price_72h numeric,
  max_high_72h numeric,
  unique (symbol, alerted_at, kind)
);

create index if not exists oi_alerts_alerted_at_idx on oi_alerts (alerted_at);

-- 2026-10-24 추가: 알림 때의 단서 (급등 후 되돌림인지 조용한 매집인지, 누가 롱/숏을 잡았나) + 들고 있었을 때 최저가
alter table oi_alerts add column if not exists high_4h numeric; -- 알림 전 4시간 최고가
alter table oi_alerts add column if not exists low_4h numeric; -- 알림 전 4시간 최저가
alter table oi_alerts add column if not exists account_ratio numeric; -- 전체 계정 롱/숏 (계정 수)
alter table oi_alerts add column if not exists top_position_ratio numeric; -- 증거금 상위 20% 롱/숏 (포지션 크기)
alter table oi_alerts add column if not exists taker_ratio_4h numeric; -- 알림 전 4시간 테이커 매수량 ÷ 매도량
alter table oi_alerts add column if not exists min_low_72h numeric; -- 72시간 지난 뒤 채움
alter table oi_alerts enable row level security;
