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
}

const STOCK_NOTE =
  "2026-03-06에 0원으로 시작해 매월 10일 100만원씩 입금해서 모든 매수, 매도는 그날 종가로 체결했다고 가정함 " +
  "(배당은 배당락일에 반영, 매일 오전 7시 30분에 업데이트)";

export const AI_TRADERS: AiMeta[] = [
  {
    id: "wallstreet",
    name: "AI 월가",
    summary: "S&P500·나스닥100 지수 적립식",
    rules: [
      "매월 입금액으로 VOO(S&P500)·QQQ(나스닥100)를 50%씩 매수",
      "배당은 같은 ETF에 재투자, 매도 없음",
    ],
    note: STOCK_NOTE,
  },
  {
    id: "korean_ant",
    name: "AI 한국개미",
    summary: "코스피200 원화 적립식",
    rules: [
      "매월 입금액으로 KODEX 200 매수, 배당 재투자",
      "원화로 매수하고 달러로 환산해 표시 (환율 손익 포함)",
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
      "품질이 훼손될 때만 매도, 금·채권은 보유하지 않음",
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
    id: "hobanhoney",
    name: "AI 호반꿀",
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

// 한국 ETF는 원화, 나머지는 USD로 거래한다.
export function isKrwSymbol(symbol: string) {
  return symbol.endsWith(".KS");
}

export function displayAiSymbol(symbol: string) {
  if (symbol === "069500.KS") return "KODEX 200";
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
  };
}

// 평가액 기준 가장 큰 보유 종목 (숏은 크기로 비교)
export function largestHolding(holdings: AiHolding[]) {
  return holdings.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] ?? null;
}

export async function getAiSummaries() {
  const supabase = getSupabase();
  const [{ data: holdingRows }, latestRows] = await Promise.all([
    supabase.from("ai_holdings").select("*"),
    Promise.all(
      AI_TRADERS.map((meta) =>
        supabase
          .from("ai_equity_daily")
          .select("date, cash, equity, invested")
          .eq("ai", meta.id)
          .order("date", { ascending: false })
          .limit(1),
      ),
    ),
  ]);

  return AI_TRADERS.map((meta, i) => {
    const latest = latestRows[i].data?.[0];
    const holdings = ((holdingRows ?? []) as HoldingDbRow[])
      .filter((row) => row.ai === meta.id)
      .map(toHolding);
    return { meta, latest: latest ? toEquity(latest as AiEquity) : null, holdings };
  });
}

export async function getAiDetail(id: string) {
  const meta = AI_TRADERS.find((ai) => ai.id === id);
  if (!meta) return null;
  const supabase = getSupabase();

  // Supabase는 한 번에 1000행까지만 돌려줘서 나눠 읽는다 (하루 1행이라 3년쯤 지나면 넘는다).
  const equity: AiEquity[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("ai_equity_daily")
      .select("date, cash, equity, invested")
      .eq("ai", id)
      .order("date")
      .range(from, from + 999);
    equity.push(...((data ?? []) as AiEquity[]).map(toEquity));
    if (!data || data.length < 1000) break;
  }

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

// 운영자 월별 성과와 같은 방식: 시드 = 월초 자산 + 그 달 입금, 손익 = 월말 자산 − 시드.
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
      const pnl = end.equity - seed;
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
