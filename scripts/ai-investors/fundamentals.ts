// SEC 재무로 시총·잉여현금흐름 등을 계산한다. 모든 함수는 판단일(day)까지 공시된 값만 쓴다 (미래 정보 차단).
import type { Market } from "./market.ts";
import { COVER_SHARES_TAG } from "./sources.ts";
import type { FactRow } from "./sources.ts";

export const REVENUE = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
];
export const DEPRECIATION = [
  "DepreciationDepletionAndAmortization",
  "DepreciationAndAmortization",
  "DepreciationAmortizationAndAccretionNet",
];
export const LONG_TERM_DEBT = ["LongTermDebtNoncurrent", "LongTermDebt"];
export const CASH = ["CashAndCashEquivalentsAtCarryingValue"];
export const NET_INCOME = ["NetIncomeLoss"];
export const EQUITY = ["StockholdersEquity"];
export const OPERATING_CASH_FLOW = ["NetCashProvidedByUsedInOperatingActivities"];
export const CAPEX = ["PaymentsToAcquirePropertyPlantAndEquipment"];
export const OPERATING_INCOME = ["OperatingIncomeLoss"];

function daysBetween(later: string, earlier: string) {
  return (Date.parse(later) - Date.parse(earlier)) / 86_400_000;
}

// 후보 항목 중 판단일까지 값이 있는 첫 번째 항목의 행들
function rowsOf(market: Market, cik: string, tags: string[], day: string): FactRow[] {
  for (const tag of tags) {
    const rows = (market.facts.get(cik)?.get(tag) ?? []).filter((row) => row.filed <= day);
    if (rows.length > 0) return rows;
  }
  return [];
}

// 회계연도 값 (10-K, 기간 350~380일). 같은 기간이 여러 번 공시됐으면 가장 늦은 값(정정 반영).
export function annual(market: Market, cik: string, tags: string[], day: string) {
  const byEnd = new Map<string, FactRow>();
  for (const row of rowsOf(market, cik, tags, day)) {
    if (row.form !== "10-K" || !row.period_start) continue;
    const length = daysBetween(row.period_end, row.period_start);
    if (length < 350 || length > 380) continue;
    const seen = byEnd.get(row.period_end);
    if (!seen || row.filed >= seen.filed) byEnd.set(row.period_end, row);
  }
  return [...byEnd.values()].sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// 시점 값(자본·부채·현금). end를 주면 그 날짜의 값.
export function instant(market: Market, cik: string, tags: string[], day: string, end?: string) {
  const rows = rowsOf(market, cik, tags, day).filter(
    (row) => !row.period_start && (end === undefined || row.period_end === end),
  );
  if (rows.length === 0) return null;
  const latest = rows.reduce((a, b) =>
    a.period_end > b.period_end || (a.period_end === b.period_end && a.filed >= b.filed) ? a : b,
  );
  return latest.value;
}

// 최근 4분기 합 = 최근 연간 + (올해 누적 − 작년 같은 기간 누적). 연간값만 쓰면 급성장주가 비싸 보인다.
export function ttm(market: Market, cik: string, tags: string[], day: string) {
  let best: { tag: string; row: FactRow } | null = null;
  for (const tag of tags) {
    const row = annual(market, cik, [tag], day).at(-1);
    if (row && (!best || row.period_end > best.row.period_end)) best = { tag, row };
  }
  // 1년 반 넘게 지난 값은 쓰지 않는다 (항목 이름이 바뀌어 끊긴 경우 등)
  if (!best || daysBetween(day, best.row.period_end) > 550) return null;

  const fiscalYearEnd = best.row.period_end;
  const tagRows = rowsOf(market, cik, [best.tag], day);
  const yearToDate = tagRows.filter((row) => {
    if (row.form !== "10-Q" || !row.period_start) return false;
    const gap = daysBetween(row.period_start, fiscalYearEnd);
    return gap > 0 && gap <= 10;
  });
  if (yearToDate.length === 0) return best.row.value;
  const current = yearToDate.reduce((a, b) =>
    a.period_end > b.period_end || (a.period_end === b.period_end && a.filed >= b.filed) ? a : b,
  );
  const lastYear = tagRows.filter(
    (row) =>
      row.period_start &&
      Math.abs(daysBetween(current.period_start!, row.period_start) - 365) <= 10 &&
      Math.abs(daysBetween(current.period_end, row.period_end) - 365) <= 10,
  );
  if (lastYear.length === 0) return best.row.value;
  const previous = lastYear.reduce((a, b) => (a.filed >= b.filed ? a : b));
  return best.row.value + current.value - previous.value;
}

// 야후 가격은 이후 분할(분사 조정 포함)까지 소급 반영돼 있다. 공시 뒤에 일어난 분할만큼 주식수를 맞춰줘야
// 가격×주식수가 맞는다. (KLAC 2026-06 10:1 분할 전 공시를 그대로 쓰면 시총이 1/10로 나왔음)
function splitFactor(market: Market, symbol: string, filed: string) {
  let factor = 1;
  for (const split of market.splits.get(symbol) ?? []) {
    if (split.date > filed) factor *= split.ratio;
  }
  return factor;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// 최근 3개 공시의 중간값 (한 번 튀는 오타를 거른다)
function recentShares(market: Market, symbol: string, cik: string, tag: string, day: string) {
  const rows = (market.facts.get(cik)?.get(tag) ?? [])
    .filter((row) => row.filed <= day)
    .sort((a, b) => a.period_end.localeCompare(b.period_end) || a.filed.localeCompare(b.filed));
  if (rows.length === 0) return null;
  return median(rows.slice(-3).map((row) => row.value * splitFactor(market, symbol, row.filed)));
}

// SEC 원본엔 단위 오타(PKG 1000배, MCD·WAT 등)와 주식 종류별 공시(GOOGL·META·V) 문제가 섞여 있다.
// 표지 주식수 · 희석 주식수 · 대차대조표 주식수 · 순이익÷EPS 중 두 개 이상이 25% 안에서 일치할 때만 쓰고,
// 확인이 안 되면 null(계산에서 제외)이다.
export function shares(market: Market, symbol: string, cik: string, day: string) {
  let fromEps: number | null = null;
  const netIncome = new Map(
    annual(market, cik, NET_INCOME, day).map((row) => [row.period_end, row.value]),
  );
  const eps = annual(market, cik, ["EarningsPerShareDiluted"], day).filter((row) =>
    netIncome.has(row.period_end),
  );
  const latestEps = eps.at(-1);
  if (latestEps && Math.abs(latestEps.value) >= 0.05) {
    fromEps =
      (netIncome.get(latestEps.period_end)! / latestEps.value) *
      splitFactor(market, symbol, latestEps.filed);
  }

  const estimates = [
    recentShares(market, symbol, cik, COVER_SHARES_TAG, day),
    recentShares(market, symbol, cik, "WeightedAverageNumberOfDilutedSharesOutstanding", day),
    recentShares(market, symbol, cik, "CommonStockSharesOutstanding", day),
    fromEps,
  ].filter((value): value is number => value !== null && value > 0);

  for (const base of estimates) {
    const agreeing = estimates.filter((value) => Math.abs(value / base - 1) <= 0.25);
    if (agreeing.length >= 2) return median(agreeing);
  }
  return null;
}

export function marketCap(market: Market, symbol: string, cik: string, day: string) {
  const price = market.price(symbol, day);
  let count = shares(market, symbol, cik, day);
  if (!price || !count) return null;
  if (symbol === "BRK-B") count *= 1500; // 버크셔 주식수는 A주 기준, B주 1500주 = A주 1주
  return price * count;
}

// 잉여현금흐름 = 영업현금흐름 − 설비투자 (최근 4분기)
export function freeCashFlow(market: Market, cik: string, day: string) {
  const operating = ttm(market, cik, OPERATING_CASH_FLOW, day);
  if (operating === null) return null;
  return operating - (ttm(market, cik, CAPEX, day) ?? 0);
}
