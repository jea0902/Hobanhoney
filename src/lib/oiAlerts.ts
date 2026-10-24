import { getSupabase } from "@/lib/supabase";

// scripts/oi-alerts가 매시간 쌓는 바이낸스 선물 OI 급증 기록 (TODO 38번)
export interface OiAlertRow {
  id: string;
  symbol: string;
  kind: "alert" | "control";
  alerted_at: string;
  oi_usd: number;
  oi_change_4h: number;
  price: number;
  price_change_4h: number;
  funding_rate: number | null;
  price_24h: number | null;
  price_72h: number | null;
  max_high_72h: number | null;
}

export async function getOiAlerts() {
  const { data, error } = await getSupabase()
    .from("oi_alerts")
    .select("*")
    .order("alerted_at", { ascending: false });
  if (error) throw error;
  return data as OiAlertRow[];
}

// 72시간 결과가 채워진 기록만 모아 "72시간 안 최고가가 +30%·+100%에 닿은 비율"을 낸다.
export function summarize(rows: OiAlertRow[], kind: "alert" | "control") {
  const done = rows.filter((r) => r.kind === kind && r.max_high_72h !== null);
  const ups = done.map((r) => r.max_high_72h! / r.price - 1);
  const share = (threshold: number) =>
    done.length === 0 ? null : ups.filter((u) => u >= threshold).length / done.length;
  return { count: done.length, hit30: share(0.3), hit100: share(1) };
}
