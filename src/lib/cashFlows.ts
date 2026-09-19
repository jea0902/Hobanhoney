import { getSupabase } from "@/lib/supabase";
import type { CashFlowRecord } from "@/lib/bybitPrivate";

export async function upsertCashFlows(records: CashFlowRecord[]) {
  if (records.length === 0) return;
  const supabase = getSupabase();
  await supabase.from("cash_flows").upsert(
    records.map((record) => ({
      tx_id: record.txId,
      type: record.type,
      coin: record.coin,
      amount: record.amount,
      occurred_at: record.occurredAt,
    })),
    { onConflict: "tx_id", ignoreDuplicates: true },
  );
}

export interface StoredCashFlow {
  type: "deposit" | "withdraw";
  coin: string;
  amount: number;
  occurredAt: string;
}

export async function getCashFlows(): Promise<StoredCashFlow[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("cash_flows")
    .select("type, coin, amount, occurred_at")
    .order("occurred_at", { ascending: true });

  return (data ?? []).map((row) => ({
    type: row.type,
    coin: row.coin,
    amount: Number(row.amount),
    occurredAt: row.occurred_at,
  }));
}
