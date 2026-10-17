import { getSupabase } from "@/lib/supabase";
import { displaySymbol } from "@/lib/symbol";

// AI 투자자 결과는 scripts/ai-investors가 매일 계산해서 ai_* 테이블에 넣는다 (TODO.md 19번).
// 여기는 화면에 보여줄 이름·전략 설명과 읽기 함수만 둔다.
export interface AiMeta {
  id: string;
  name: string;
  summary: string;
  rules: string[];
  note: string; // 계산 가정 (전략 아래에 작게 표시)
  seoTitle?: string; // 검색 결과 제목. 사람들이 실제로 검색할 말(원래 트레이더 이름 등)을 앞에 둔다
}

const STOCK_NOTE =
  "2026-03-06에 0원으로 시작해 매월 10일 100만원씩 입금해서 모든 매수, 매도는 그날 종가로 체결했다고 가정함 " +
  "(배당은 배당락일에 반영, 매일 오전 7시 30분에 업데이트)";

// 화면에 나오는 순서. 가장 눈에 띄게 AI 워뇨띠, 그다음 AI 호반꿀(사이트 대표 AI)을 맨 위에 둔다.
export const AI_TRADERS: AiMeta[] = [
  {
    id: "wonyotti",
    name: "AI 워뇨띠",
    seoTitle: "워뇨띠 매매 기록 분석 · AI 워뇨띠 실시간 포지션 | 호반꿀",
    summary: "워뇨띠의 실제 매매 습관과 원칙을 닮게 만든 BTC·ETH 트레이딩",
    rules: [
      "상승 추세(BTC가 50일 평균 위)에서는 자산의 30%를 BTC 롱으로 기본 보유, 50일 평균 아래로 내려가면 정리",
      "단타는 24시간 변동폭과 거래량이 평소 이상일 때만 진입 (변동폭은 BTC 최근 30일 중간값 이상, ETH 상위 25%)",
      "최근 4시간 가격 범위의 아래 1/3에서 롱, 위 1/3에서 숏",
      "2분할 진입: 자산의 25%씩, 두 번째는 첫 진입가에서 0.3%(ETH 0.4%)",
      "익절 +0.6%(ETH +1.15%), 손절 -3.2%(ETH -7.8%), 8시간(ETH 10시간) 지나면 정리, 청산 후 12시간(ETH 48시간) 휴식",
      "단타 숫자는 워뇨띠의 2018~2021 BitMEX 실제 체결 기록에서, 기본 포지션·거래량 조건·2분할은 본인의 100문 100답에서 가져옴",
    ],
    note:
      "2026-03-06에 0원으로 시작해 매월 10일 100만원씩 입금해서 Bybit 1시간봉으로 체결했다고 가정함 " +
      "(지정가 체결 수수료 0.02%·손절과 시간 정리 0.055%, 펀딩비 미반영, 한 봉 안에서는 불리한 가격이 먼저 닿았다고 가정, 매일 오전 7시 30분에 업데이트)",
  },
  {
    id: "hobanhoney",
    name: "AI 호반꿀",
    seoTitle: "박호두 반대로 하면? AI 호반꿀 실시간 포지션과 수익률 | 호반꿀",
    summary: "인간지표 박호두의 반대 포지션",
    rules: [
      "박호두와 같은 종목·레버리지·진입가로 반대 포지션, 박호두 종료 시 함께 종료",
      "매번 시드의 10%만 투입, 연속 2회 강제청산 시 7일 휴식",
      "2026-09-27 이후 기록부터 추종",
    ],
    note:
      "2026-03-06에 0원으로 시작해 매월 10일 100만원씩 입금해서 박호두의 진입가·종료가로 체결했다고 가정함 " +
      "(강제청산은 Bybit 1분봉으로 판정, 수수료 0.055% 반영·펀딩비 미반영, 매일 오전 7시 30분에 업데이트)",
  },
  {
    id: "wallstreet",
    name: "AI 월가",
    summary: "미국 주식·채권·금·비트코인 자산배분",
    rules: [
      "목표 비중: S&P500(VOO) 30%, 나스닥100(QQQ) 30%, 단기 미국채(SGOV) 20%, 금(GLD) 10%, 비트코인(IBIT) 10%",
      "매월 입금액은 목표 비중보다 모자란 자산부터 매수",
      "목표 비중에서 5%p 넘게 벗어난 자산이 있으면 전체를 목표 비중으로 리밸런싱",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "korean_ant",
    name: "AI 한국개미",
    summary: "국내 주식·채권·금·비트코인 자산배분",
    rules: [
      "목표 비중: 코스피200(KODEX 200) 50%, 코스닥150(KODEX 코스닥150) 20%, 국고채 3년(KODEX 국고채3년) 15%, 금(ACE KRX금현물) 10%, 비트코인 5%",
      "매월 입금액을 목표 비중대로 매수",
      "매년 12월 마지막 거래일에 전량 매도 후 1월 10일에 목표 비중대로 재매수",
      "원화로 매수하고 달러로 환산해 표시 (환율 손익 포함), 비트코인은 국내 현물 ETF가 없어 직접 보유로 계산",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "fear_greed",
    name: "AI 공포탐욕",
    summary: "현금을 모아 두었다가 공포 구간에서만 분할 매수",
    rules: [
      "평소에는 입금액을 현금(단기국채)으로 보유",
      "S&P500 고점 대비 -10%·-20%·-30% 또는 VIX 30·40 이상에서 단계별로 VOO 분할 매수",
      "신고가 근처의 과열 구간(VIX 13 이하)에서 20%씩 분할 매도",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "buffett",
    name: "AI 버핏",
    summary: "버핏 기준의 우량주를 싸게 사서 장기 보유",
    rules: [
      "10년간 ROE가 꾸준히 높고 부채가 적은 우량주만 선별 (버핏 1987년 주주서한 기준)",
      "현금흐름 대비 주가가 장기 국채 금리보다 매력적일 때만 매수, 최대 10종목",
      "주가와 관계없이 우량주 기준(ROE·부채)에서 벗어날 때만 매도",
      "매수하고 남는 돈은 버크셔처럼 미국 단기국채로 보유, 금·장기채는 보유하지 않음",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "burry",
    name: "AI 버리",
    summary: "소외된 저평가주 매수, 버블 종목 공매도",
    rules: [
      "52주 고점 대비 크게 하락했지만 현금흐름이 흑자인 저부채 종목 5개 매수",
      "매출 대비 과도하게 오른 대형주 3개 공매도 (1.5배 상승 시 손절)",
      "금 10% 보유, 매월 리밸런싱",
      "실제 버리가 쓴 풋옵션 대신 공매도로 구현",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "martin",
    name: "AI 마틴",
    summary: "BTC 추세추종에 마틴게일·켈리 베팅을 더한 고레버리지 매매",
    rules: [
      "주봉 20주선 > 50주선이고 일봉 50일선 > 200일선이면 롱만, 둘 다 반대면 숏만, 엇갈리면 관망",
      "그 방향으로 4시간봉 20선이 50선을 돌파할 때 BTC 10배 진입",
      "일봉 종가가 20일선을 반대로 2일 연속 넘으면 추세 종료로 보고 청산 (그 전까지는 익절하지 않음)",
      "1회차 증거금은 쿼터 켈리(켈리의 1/4): 지금까지의 같은 규칙 매매(2021년부터) 승률·손익비로 계산, 불리하면 계좌의 1%",
      "마틴게일: 강제청산되면 다음 증거금을 직전의 2배로, 추세 종료로 청산하면 1회차로. 다음 회차를 계좌가 감당하지 못하면 1회차로 리셋",
    ],
    note:
      "2026-03-06에 0원으로 시작해 매월 10일 100만원씩 입금해서 Bybit 4시간봉 종가로 체결했다고 가정함 " +
      "(일봉·주봉은 4시간봉을 UTC 기준으로 묶어 계산, 강제청산은 4시간봉 고가·저가로 판정, 수수료 0.055% 반영·펀딩비 미반영, 매일 오전 7시 30분에 업데이트)",
  },
];

export interface AiHolding {
  symbol: string;
  quantity: number; // 숏은 음수
  avgPrice: number;
  leverage: number | null;
  openedAt: string;
  value: number; // USD
}

export interface AiEquity {
  date: string;
  cash: number;
  equity: number;
  invested: number;
  withdrawn: number; // 누적 출금. 지금은 모든 AI가 0 (2026-10-17 워뇨띠 출금 규칙 제거)
}

export interface AiTrade {
  tradedAt: string;
  symbol: string;
  side: "buy" | "sell" | "short" | "cover";
  quantity: number;
  price: number;
  leverage: number | null;
  reason: string;
}

// 한국 ETF와 AI 한국개미의 비트코인(BTC-KRW)은 원화, 나머지는 USD로 거래한다.
export function isKrwSymbol(symbol: string) {
  return symbol.endsWith(".KS") || symbol.endsWith("-KRW");
}

const AI_SYMBOL_NAMES: Record<string, string> = {
  "069500.KS": "KODEX 200",
  "229200.KS": "KODEX 코스닥150",
  "114260.KS": "KODEX 국고채3년",
  "411060.KS": "ACE KRX금현물",
  "BTC-KRW": "비트코인",
};

export function displayAiSymbol(symbol: string) {
  if (AI_SYMBOL_NAMES[symbol]) return AI_SYMBOL_NAMES[symbol];
  return displaySymbol(symbol);
}

interface HoldingDbRow {
  ai: string;
  symbol: string;
  quantity: number;
  avg_price: number;
  leverage: number | null;
  opened_at: string;
  value: number;
}

function toHolding(row: HoldingDbRow): AiHolding {
  return {
    symbol: row.symbol,
    quantity: Number(row.quantity),
    avgPrice: Number(row.avg_price),
    leverage: row.leverage === null ? null : Number(row.leverage),
    openedAt: row.opened_at,
    value: Number(row.value),
  };
}

function toEquity(row: AiEquity): AiEquity {
  return {
    date: row.date,
    cash: Number(row.cash),
    equity: Number(row.equity),
    invested: Number(row.invested),
    withdrawn: Number(row.withdrawn ?? 0),
  };
}

// 평가액 기준 가장 큰 보유 종목 (숏은 크기로 비교)
export function largestHolding(holdings: AiHolding[]) {
  return holdings.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] ?? null;
}

// 출금한 돈도 번 돈이므로 손익은 항상 "자산 + 누적 출금" 기준으로 계산한다 (출금 안 하는 AI는 출금 0).
function withWithdrawals(row: AiEquity) {
  return row.equity + row.withdrawn;
}

// 누적 수익률 = (자산 + 누적 출금 − 누적 입금) ÷ 누적 입금
export function totalReturnPercent(latest: AiEquity) {
  if (latest.invested <= 0) return null;
  return (withWithdrawals(latest) / latest.invested - 1) * 100;
}

// 연 수익률 = 올해 손익 ÷ 전체 누적 입금. 매년 1월 1일에 0부터 다시 시작한다.
// 올해 손익 = (지금 자산 + 누적 출금) − (작년 말 자산 + 누적 출금) − 올해 입금 (작년 기록이 없으면 작년 말 값은 0).
export function annualReturnPercent(latest: AiEquity, lastYearEnd: AiEquity | null) {
  if (latest.invested <= 0) return null;
  const depositsThisYear = latest.invested - (lastYearEnd?.invested ?? 0);
  const profitThisYear =
    withWithdrawals(latest) - (lastYearEnd ? withWithdrawals(lastYearEnd) : 0) - depositsThisYear;
  return (profitThisYear / latest.invested) * 100;
}

// 작년 마지막 날 기록 (equity는 날짜순)
export function lastYearEndOf(equity: AiEquity[], latest: AiEquity) {
  return equity.filter((row) => row.date < `${latest.date.slice(0, 4)}-01-01`).at(-1) ?? null;
}

// 홈 카드의 미니 그래프에 쓰는 최근 기간 (일)
const SPARKLINE_DAYS = 120;

async function getLatestAndLastYearEnd(id: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("ai_equity_daily")
    .select("date, cash, equity, invested, withdrawn")
    .eq("ai", id)
    .order("date", { ascending: false })
    .limit(SPARKLINE_DAYS);
  const recent = ((data ?? []) as AiEquity[]).map(toEquity).reverse();
  const latest = recent.at(-1) ?? null;
  if (!latest) return { latest: null, lastYearEnd: null, recent };
  const { data: before } = await supabase
    .from("ai_equity_daily")
    .select("date, cash, equity, invested, withdrawn")
    .eq("ai", id)
    .lt("date", `${latest.date.slice(0, 4)}-01-01`)
    .order("date", { ascending: false })
    .limit(1);
  return { latest, lastYearEnd: before?.[0] ? toEquity(before[0] as AiEquity) : null, recent };
}

export async function getAiSummaries() {
  const supabase = getSupabase();
  const [{ data: holdingRows }, equities] = await Promise.all([
    supabase.from("ai_holdings").select("*"),
    Promise.all(AI_TRADERS.map((meta) => getLatestAndLastYearEnd(meta.id))),
  ]);

  return AI_TRADERS.map((meta, i) => {
    const { latest, lastYearEnd, recent } = equities[i];
    const holdings = ((holdingRows ?? []) as HoldingDbRow[])
      .filter((row) => row.ai === meta.id)
      .map(toHolding);
    return {
      meta,
      latest,
      annualReturn: latest ? annualReturnPercent(latest, lastYearEnd) : null,
      holdings,
      // 날짜별 누적 수익률 (입금 시점이 달라도 모양을 비교할 수 있게 금액 대신 수익률로)
      returnSeries: recent.map((row) => totalReturnPercent(row) ?? 0),
    };
  });
}

// 날짜순 일별 자산. Supabase는 한 번에 1000행까지만 돌려줘서 나눠 읽는다 (하루 1행이라 3년쯤 지나면 넘는다).
async function getEquityRows(id: string) {
  const supabase = getSupabase();
  const equity: AiEquity[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("ai_equity_daily")
      .select("date, cash, equity, invested, withdrawn")
      .eq("ai", id)
      .order("date")
      .range(from, from + 999);
    equity.push(...((data ?? []) as AiEquity[]).map(toEquity));
    if (!data || data.length < 1000) break;
  }
  return equity;
}

export async function getAiDetail(id: string) {
  const meta = AI_TRADERS.find((ai) => ai.id === id);
  if (!meta) return null;
  const supabase = getSupabase();
  const equity = await getEquityRows(id);

  const [{ data: holdingRows }, { data: tradeRows }] = await Promise.all([
    supabase.from("ai_holdings").select("*").eq("ai", id),
    supabase
      .from("ai_trades")
      .select("traded_at, symbol, side, quantity, price, leverage, reason")
      .eq("ai", id)
      .order("traded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  return {
    meta,
    equity,
    holdings: ((holdingRows ?? []) as HoldingDbRow[]).map(toHolding),
    trades: (tradeRows ?? []).map((row) => ({
      tradedAt: row.traded_at,
      symbol: row.symbol,
      side: row.side,
      quantity: Number(row.quantity),
      price: Number(row.price),
      leverage: row.leverage === null ? null : Number(row.leverage),
      reason: row.reason,
    })) as AiTrade[],
  };
}

export interface AiMonth {
  month: string;
  seed: number;
  pnl: number;
  endEquity: number;
  returnPercent: number | null;
}

// 운영자 월별 성과와 같은 방식: 시드 = 월초 자산 + 그 달 입금, 손익 = 월말 자산 + 그 달 출금 − 시드.
// 월초 자산은 전달 마지막 날 자산. 최신 달이 먼저 오게 돌려준다.
export function getMonthlyPerformance(equity: AiEquity[]): AiMonth[] {
  const months = [...new Set(equity.map((row) => row.date.slice(0, 7)))];
  return months
    .map((month) => {
      const before = equity.filter((row) => row.date < `${month}-01`).at(-1);
      const end = equity.filter((row) => row.date.startsWith(month)).at(-1)!;
      const startEquity = before?.equity ?? 0;
      const deposits = end.invested - (before?.invested ?? 0);
      const seed = startEquity + deposits;
      const withdrawals = end.withdrawn - (before?.withdrawn ?? 0);
      const pnl = end.equity + withdrawals - seed;
      return {
        month,
        seed,
        pnl,
        endEquity: end.equity,
        returnPercent: seed > 0 ? (pnl / seed) * 100 : null,
      };
    })
    .reverse();
}

// AI 탭 그래프용: 월마다 AI별 시드 대비 수익률. 아직 기록이 없는 달은 null.
export async function getMonthlyReturnsByAi() {
  const perAi = await Promise.all(
    AI_TRADERS.map(async (meta) => ({
      id: meta.id,
      months: getMonthlyPerformance(await getEquityRows(meta.id)),
    })),
  );
  const months = [...new Set(perAi.flatMap((ai) => ai.months.map((m) => m.month)))].sort();
  return months.map((month) => {
    const row: Record<string, string | number | null> = { month };
    for (const ai of perAi) {
      row[ai.id] = ai.months.find((m) => m.month === month)?.returnPercent ?? null;
    }
    return row;
  });
}

// AI 탭 잔액 추이 그래프용: 날짜마다 AI별 총자산·누적 입금(`{id}_invested`)과 그래프용 공통 누적 입금(`invested`).
// AI마다 기록 날짜가 달라서(미국·한국 거래일, 코인은 매일) 기록이 없는 날은 직전 값을 이어 쓴다.
// 모든 AI가 같은 날 같은 금액을 입금하므로 누적 입금은 하나만 그린다(환율 차이로 조금씩 달라서 가장 큰 값).
export async function getEquityTimeline() {
  const perAi = await Promise.all(
    AI_TRADERS.map(async (meta) => ({
      id: meta.id,
      byDate: new Map((await getEquityRows(meta.id)).map((row) => [row.date, row])),
    })),
  );
  const dates = [...new Set(perAi.flatMap((ai) => [...ai.byDate.keys()]))].sort();
  const last = new Map<string, AiEquity>();
  return dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    let invested = 0;
    for (const ai of perAi) {
      const today = ai.byDate.get(date);
      if (today) last.set(ai.id, today);
      const latest = last.get(ai.id);
      row[ai.id] = latest ? latest.equity : null;
      // 손익·수익률 보기는 AI마다 실제로 넣은 돈(입금일 환율이 조금씩 다름) 기준으로 계산한다
      row[`${ai.id}_invested`] = latest ? latest.invested : null;
      invested = Math.max(invested, latest?.invested ?? 0);
    }
    row.invested = invested;
    return row;
  });
}
