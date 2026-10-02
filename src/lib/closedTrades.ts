import { getSupabase } from "@/lib/supabase";
import type { ClosedTradeRecord } from "@/lib/bybitPrivate";
import { getBalanceSnapshots } from "@/lib/balanceSnapshots";
import type { BalanceSnapshot } from "@/lib/balanceSnapshots";
import { getCashFlows } from "@/lib/cashFlows";
import type { StoredCashFlow } from "@/lib/cashFlows";
import { getWinRate } from "@/lib/positionMath";

// 계정 입출금 기록엔 추적 이전(2024~2025) 내역도 섞여 있어서, 추적 시작일(26.03.06 KST) 이후만 시드로 센다.
const TRACKING_START = new Date("2026-03-06T00:00:00+09:00").getTime();

// 시드 = 월초 자산 + 그 달 입금. 출금은 빼지 않는다 — 월말에 수익을 빼면 시드가 쪼그라들어
// 수익률이 부풀었다(9월: 1,760 출금 후 80% → 421%). 월초 자산은 그 달 첫 잔액 스냅샷.
// snapshots는 시간순(오래된 것 먼저) 정렬이어야 그 달 첫 스냅샷이 월초 자산이 된다.
export function getMonthSeed(
  month: string,
  snapshots: BalanceSnapshot[],
  cashFlows: StoredCashFlow[],
) {
  const monthStartEquity =
    snapshots.find((snapshot) => toKstMonth(snapshot.recordedAt) === month)?.totalEquity ?? 0;
  const monthDeposits = cashFlows
    .filter(
      (flow) =>
        flow.coin === "USDT" &&
        flow.type === "deposit" &&
        new Date(flow.occurredAt).getTime() >= TRACKING_START &&
        toKstMonth(flow.occurredAt) === month,
    )
    .reduce((sum, flow) => sum + flow.amount, 0);
  return monthStartEquity + monthDeposits;
}

export async function upsertClosedTrades(records: ClosedTradeRecord[]) {
  if (records.length === 0) return;
  const supabase = getSupabase();
  await supabase.from("closed_trades").upsert(
    records.map((record) => ({
      order_id: record.orderId,
      symbol: record.symbol,
      closed_pnl: record.closedPnl,
      direction: record.direction,
      avg_entry_price: record.avgEntryPrice,
      closed_at: record.closedAt,
    })),
    { onConflict: "order_id" },
  );
}

interface DirectionStats {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number | null;
}

export interface WinRateStats extends DirectionStats {
  long: DirectionStats;
  short: DirectionStats;
}

interface ClosedTradeRow {
  closed_pnl: number;
  direction: "Long" | "Short" | null;
  symbol: string;
  avg_entry_price: number | null;
  closed_at: string;
}

interface GroupedTrade {
  pnl: number;
  direction: "Long" | "Short" | null;
  lastClosedAt: string;
}

// 포지션 하나가 여러 번 부분청산되면 orderId가 다른 별도 행으로 쌓이는데, 같은 진입가(avgEntryPrice)를
// 공유하는 행들은 사실 같은 포지션의 조각들이라 합산 손익 기준으로 1승/1패만 세야 한다.
function groupIntoTrades(rows: ClosedTradeRow[]): GroupedTrade[] {
  const groups = new Map<string, GroupedTrade>();
  for (const row of rows) {
    const key = `${row.symbol}:${row.avg_entry_price}`;
    const existing = groups.get(key);
    if (existing) {
      existing.pnl += Number(row.closed_pnl);
      if (row.closed_at > existing.lastClosedAt) existing.lastClosedAt = row.closed_at;
    } else {
      groups.set(key, {
        pnl: Number(row.closed_pnl),
        direction: row.direction,
        lastClosedAt: row.closed_at,
      });
    }
  }
  return Array.from(groups.values());
}

type TradeResult = "win" | "draw" | "loss";

// 포지션 손익이 그 달(마지막 청산 시각 기준) 시드의 -3% 이상 +3% 이하면 무승부.
function getTradeResult(trade: GroupedTrade, seed: number): TradeResult {
  // 시드를 못 구한 달은 비율을 낼 수 없어서 손익 부호로만 가른다.
  if (seed <= 0) return trade.pnl > 0 ? "win" : "loss";
  const seedReturnPercent = (trade.pnl / seed) * 100;
  if (seedReturnPercent > 3) return "win";
  if (seedReturnPercent < -3) return "loss";
  return "draw";
}

function toStats(results: TradeResult[]): DirectionStats {
  const wins = results.filter((result) => result === "win").length;
  const draws = results.filter((result) => result === "draw").length;
  const losses = results.filter((result) => result === "loss").length;
  return { wins, draws, losses, total: results.length, winRate: getWinRate(wins, losses) };
}

export async function getWinRateStats(): Promise<WinRateStats> {
  const supabase = getSupabase();
  const [{ data }, snapshots, cashFlows] = await Promise.all([
    supabase
      .from("closed_trades")
      .select("closed_pnl, direction, symbol, avg_entry_price, closed_at"),
    getBalanceSnapshots(),
    getCashFlows(),
  ]);
  const trades = groupIntoTrades((data ?? []) as ClosedTradeRow[]).map((trade) => ({
    direction: trade.direction,
    result: getTradeResult(
      trade,
      getMonthSeed(toKstMonth(trade.lastClosedAt), snapshots, cashFlows),
    ),
  }));
  const resultsOf = (direction?: "Long" | "Short") =>
    trades
      .filter((trade) => direction === undefined || trade.direction === direction)
      .map((trade) => trade.result);

  return {
    ...toStats(resultsOf()),
    long: toStats(resultsOf("Long")),
    short: toStats(resultsOf("Short")),
  };
}

// 월 구분은 한국시간 기준. "2026-04" 형태.
export function toKstMonth(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export interface MonthlyPnl {
  month: string;
  profit: number;
  loss: number;
  total: number;
}

// 부분청산이 여러 달에 걸치면 포지션이 최종적으로 끝난 달(마지막 청산 시각)에 합산한다.
export async function getMonthlyPnl(): Promise<MonthlyPnl[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("closed_trades")
    .select("closed_pnl, direction, symbol, avg_entry_price, closed_at");
  const trades = groupIntoTrades((data ?? []) as ClosedTradeRow[]);

  const months = new Map<string, MonthlyPnl>();
  for (const trade of trades) {
    const month = toKstMonth(trade.lastClosedAt);
    const entry = months.get(month) ?? { month, profit: 0, loss: 0, total: 0 };
    if (trade.pnl > 0) entry.profit += trade.pnl;
    else entry.loss += trade.pnl;
    entry.total += trade.pnl;
    months.set(month, entry);
  }
  return Array.from(months.values());
}
