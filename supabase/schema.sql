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

-- 주인장 포지션 페이지: Bybit은 6개월치 데이터만 보관하므로, 잔액 그래프를 위해
-- 주기적으로(6시간마다, GitHub Actions cron) 스냅샷을 직접 쌓아 영구 보관한다.
create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  total_equity numeric not null,
  recorded_at timestamptz not null default now()
);

alter table balance_snapshots enable row level security;
