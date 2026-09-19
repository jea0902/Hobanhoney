import { getSupabase } from "@/lib/supabase";

export interface BalanceSnapshot {
  totalEquity: number;
  recordedAt: string;
}

export async function recordBalanceSnapshot(totalEquity: number) {
  const supabase = getSupabase();
  await supabase.from("balance_snapshots").insert({ total_equity: totalEquity });
}

export async function getBalanceSnapshots(): Promise<BalanceSnapshot[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("balance_snapshots")
    .select("total_equity, recorded_at")
    .order("recorded_at", { ascending: true });

  return (data ?? []).map((row) => ({
    totalEquity: Number(row.total_equity),
    recordedAt: row.recorded_at,
  }));
}
