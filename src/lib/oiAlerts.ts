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
  // 2026-10-24 추가 (그 전 기록은 비어 있을 수 있음)
  high_4h: number | null;
  low_4h: number | null;
  account_ratio: number | null;
  top_position_ratio: number | null;
  taker_ratio_4h: number | null;
  min_low_72h: number | null;
}

export async function getOiAlerts() {
  const { data, error } = await getSupabase()
    .from("oi_alerts")
    .select("*")
    .order("alerted_at", { ascending: false });
  if (error) throw error;
  return data as OiAlertRow[];
}

// 알림 유형: 알림 전 4시간 동안 가장 크게 움직인 폭으로 나눈다 (2026-10-25부터 가격 조건 없이 모든 OI 급증을 기록해서).
// 시작·끝 가격만 보면 +51% 찍고 돌아온 TREE도 "조용함"이 돼서, 4시간 안 최고·최저가(없으면 끝 가격)로 본다.
export const ALERT_TYPES = ["조용함", "중간", "급등", "급락"] as const;

export function alertType(row: OiAlertRow) {
  const start = row.price / (1 + row.price_change_4h);
  const up = Math.max(row.price_change_4h, row.high_4h === null ? -1 : row.high_4h / start - 1);
  const down = Math.min(row.price_change_4h, row.low_4h === null ? 1 : row.low_4h / start - 1);
  const move = Math.max(up, -down);
  if (move <= 0.05) return "조용함";
  if (move <= 0.2) return "중간";
  return up >= -down ? "급등" : "급락";
}

// 72시간 결과가 채워진 기록만 모아 "72시간 안 최고가가 +30%·+100%에 닿은 비율"을 낸다.
export function summarize(rows: OiAlertRow[], kind: "alert" | "control") {
  const done = rows.filter((r) => r.kind === kind && r.max_high_72h !== null);
  const ups = done.map((r) => r.max_high_72h! / r.price - 1);
  const share = (threshold: number) =>
    done.length === 0 ? null : ups.filter((u) => u >= threshold).length / done.length;
  return { count: done.length, hit30: share(0.3), hit100: share(1) };
}
