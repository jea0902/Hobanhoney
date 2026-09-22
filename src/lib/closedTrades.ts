import { getSupabase } from "@/lib/supabase";
import type { ClosedTradeRecord } from "@/lib/bybitPrivate";

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
}

interface GroupedTrade {
  pnl: number;
  direction: "Long" | "Short" | null;
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
    } else {
      groups.set(key, { pnl: Number(row.closed_pnl), direction: row.direction });
    }
  }
  return Array.from(groups.values());
}

function toStats(trades: GroupedTrade[]): DirectionStats {
  const total = trades.length;
  const wins = trades.filter((trade) => trade.pnl > 0).length;
  return { wins, total, winRate: total > 0 ? (wins / total) * 100 : null };
}

export async function getWinRateStats(): Promise<WinRateStats> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("closed_trades")
    .select("closed_pnl, direction, symbol, avg_entry_price");
  const trades = groupIntoTrades((data ?? []) as ClosedTradeRow[]);

  return {
    ...toStats(trades),
    long: toStats(trades.filter((trade) => trade.direction === "Long")),
    short: toStats(trades.filter((trade) => trade.direction === "Short")),
  };
}
