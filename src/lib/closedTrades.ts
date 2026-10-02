import { getSupabase } from "@/lib/supabase";
import type { ClosedTradeRecord } from "@/lib/bybitPrivate";
import { getWinRate } from "@/lib/positionMath";

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
      entry_value: record.entryValue,
      leverage: record.leverage,
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
  entry_value: number | null;
  leverage: number | null;
  closed_at: string;
}

interface GroupedTrade {
  pnl: number;
  // 그 포지션에 들어간 증거금 = 진입 금액 ÷ 레버리지. 부분청산 조각들의 증거금을 합친 값.
  margin: number;
  direction: "Long" | "Short" | null;
  lastClosedAt: string;
}

function marginOf(row: ClosedTradeRow) {
  return row.entry_value && row.leverage ? Number(row.entry_value) / Number(row.leverage) : 0;
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
      existing.margin += marginOf(row);
      if (row.closed_at > existing.lastClosedAt) existing.lastClosedAt = row.closed_at;
    } else {
      groups.set(key, {
        pnl: Number(row.closed_pnl),
        margin: marginOf(row),
        direction: row.direction,
        lastClosedAt: row.closed_at,
      });
    }
  }
  return Array.from(groups.values());
}

type TradeResult = "win" | "draw" | "loss";

// 포지션 손익 ÷ 그 포지션 증거금이 -3% 이상 +3% 이하면 무승부.
function getTradeResult(trade: GroupedTrade): TradeResult {
  // 증거금 정보가 없는 행(진입 금액·레버리지 저장 전 기록)은 비율을 낼 수 없어서 손익 부호로만 가른다.
  if (trade.margin <= 0) return trade.pnl > 0 ? "win" : "loss";
  const returnPercent = (trade.pnl / trade.margin) * 100;
  if (returnPercent > 3) return "win";
  if (returnPercent < -3) return "loss";
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
  const { data } = await supabase
    .from("closed_trades")
    .select("closed_pnl, direction, symbol, avg_entry_price, entry_value, leverage, closed_at");
  const trades = groupIntoTrades((data ?? []) as ClosedTradeRow[]).map((trade) => ({
    direction: trade.direction,
    result: getTradeResult(trade),
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
