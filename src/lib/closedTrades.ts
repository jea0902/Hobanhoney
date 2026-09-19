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

function toStats(rows: { closed_pnl: number }[]): DirectionStats {
  const total = rows.length;
  const wins = rows.filter((row) => Number(row.closed_pnl) > 0).length;
  return { wins, total, winRate: total > 0 ? (wins / total) * 100 : null };
}

export async function getWinRateStats(): Promise<WinRateStats> {
  const supabase = getSupabase();
  const { data } = await supabase.from("closed_trades").select("closed_pnl, direction");
  const rows = data ?? [];

  return {
    ...toStats(rows),
    long: toStats(rows.filter((row) => row.direction === "Long")),
    short: toStats(rows.filter((row) => row.direction === "Short")),
  };
}
