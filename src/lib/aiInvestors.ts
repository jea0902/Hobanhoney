import { getSupabase } from "@/lib/supabase";
import { displaySymbol } from "@/lib/symbol";

// AI 투자자 결과는 scripts/ai-investors가 매일 계산해서 ai_* 테이블에 넣는다 (TODO.md 19번).
// 여기는 화면에 보여줄 이름·전략 설명과 읽기 함수만 둔다.
export interface AiMeta {
  id: string;
  name: string;
  summary: string;
  rules: string[];
  priceNote: string;
}

const STOCK_PRICE_NOTE = "모든 매수·매도는 그날 종가로 체결했다고 가정해. 배당은 배당락일에 반영.";

export const AI_TRADERS: AiMeta[] = [
  {
    id: "wallstreet",
    name: "AI 월가",
    summary: "버핏이 '대부분의 월가 전문가보다 낫다'고 한 지수 적립식",
    rules: [
      "매월 입금하면 바로 S&P500(VOO) 50%, 나스닥100(QQQ) 50% 매수",
      "배당은 같은 ETF에 다시 투자",
      "팔지도, 비중을 맞추지도 않아",
    ],
    priceNote: STOCK_PRICE_NOTE,
  },
  {
    id: "korean_ant",
    name: "AI 한국개미",
    summary: "코스피200에 매월 원화로 적립",
    rules: [
      "매월 입금하면 바로 원화로 KODEX 200 매수, 배당은 다시 투자",
      "다른 AI와 비교하려고 달러로 환산해서 보여줘 — 입금은 입금일 환율, 평가는 그날 환율이라 환율 손익도 들어가",
    ],
    priceNote: STOCK_PRICE_NOTE,
  },
  {
    id: "fear_greed",
    name: "AI 공포탐욕기계",
    summary: "매달 현금을 쌓아뒀다가 공포에서만 몰아서 산다",
    rules: [
      "입금은 현금(미국 단기국채 금리 이자)으로 쌓아둬",
      "S&P500 고점 대비 -10% 또는 VIX 30 이상 → 쌓인 현금 30%로 VOO 매수",
      "-20% 또는 VIX 40 이상 → 남은 현금 50%, -30% → 전부. 각 단계는 하락장마다 한 번, 최고가를 되찾으면 초기화",
      "최고가 근처 + VIX 13 이하 + 200일선보다 15% 넘게 높으면(환희) 20%씩 팔아. 최소 20거래일 간격, 최대 50%까지",
    ],
    priceNote: STOCK_PRICE_NOTE,
  },
  {
    id: "buffett",
    name: "AI 버핏",
    summary: "워런 버핏이 직접 밝힌 기준으로 우량주를 싸게 사서 오래 들고 간다",
    rules: [
      "10년 평균 ROE 20% 초과 + 한 해도 15% 미만 없음 (버핏 1987년 주주서한의 '경제적 탁월함' 기준)",
      "부채가 거의 없을 것 (버크셔 인수 기준) → 장기부채가 순이익 4년치 이하",
      "잉여현금흐름 ÷ 시가총액이 30년물 국채 금리 이상일 때만 매수 (오너 어닝스를 장기 국채 금리로 할인)",
      "최대 10종목 균등, 비싸면 안 사고 현금(단기국채)으로 기다려",
      "가격이 아니라 품질 기준에서 떨어질 때만 팔아 (분기마다 점검). 금·채권은 안 사",
      "S&P500 종목 중 금융주는 빼고 골라 (은행은 부채 구조상 기준이 안 맞아서)",
    ],
    priceNote: STOCK_PRICE_NOTE,
  },
  {
    id: "burry",
    name: "AI 버리",
    summary: "마이클 버리처럼 버려진 싼 주식을 사고, 버블 종목에 하락 베팅",
    rules: [
      "롱: 52주 고점 대비 -40% 이하로 '로드킬'처럼 빠진 종목 중 잉여현금흐름 흑자 + 순부채가 EBITDA 1배 이하인 것을 EV/EBITDA 낮은 순으로 5개 (종목당 15%)",
      "숏: 시가총액 100위 안에서 매출 대비 20배 넘게 비싸고 6개월간 가장 많이 오른 3개 (종목당 10%). 가격이 1.5배 되면 손절",
      "금 10% (버리가 말한 '달러 약세 대비'), 나머지는 현금(단기국채)",
      "매월 입금일에 전부 다시 맞춰",
      "실제 버리는 풋옵션을 썼지만 옵션 과거 데이터를 무료로 구할 수 없어서 공매도로 대신해 (대차수수료 연 0.5%, 숏 중 배당은 대신 냄)",
    ],
    priceNote: STOCK_PRICE_NOTE,
  },
  {
    id: "hobanhoney",
    name: "AI 호반꿀",
    summary: "인간지표 박호두의 반대로만 간다",
    rules: [
      "박호두가 포지션을 열면 같은 종목·레버리지·진입가로 반대 포지션, 박호두가 닫으면(강제청산 포함) 같이 닫아",
      "매번 시드의 10%만 증거금으로 넣어",
      "강제청산되면 한 번 더 들어가고, 연속 2번 강제청산되면 7일 쉬어",
      "2026-09-27부터 따라 해 (그 전 박호두 기록은 종료가격이 없어서)",
    ],
    priceNote:
      "박호두의 진입가·종료가로 체결했다고 가정해. 강제청산은 Bybit 1분봉으로 판정하고 수수료 0.055%는 넣었지만 펀딩비는 빠져 있어.",
  },
];

export const AI_COMMON_NOTE =
  "2026-03-06에 0원으로 시작해서 매월 10일 100만원씩 입금했다고 가정해.";

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
