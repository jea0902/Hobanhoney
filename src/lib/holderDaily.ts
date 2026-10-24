import { getSupabase } from "@/lib/supabase";

// scripts/holder-watch가 매일 남기는 BSC·이더리움 토큰 보유자 쏠림 요약 (TODO 39번 B)
export interface HolderDailyRow {
  id: string;
  date: string;
  symbol: string;
  chain: "bsc" | "eth";
  token_address: string;
  coingecko_id: string | null;
  tracked_since: string;
  wallets: number;
  active_wallets: number;
  new_wallets: number;
  top10_net_pct: number | null;
  top10_balance_pct: number | null;
  missed_blocks: number;
}

// 가장 최근 날짜의 요약 (상위 10개 지갑 목록 top10은 화면에 안 써서 빼고 받는다)
export async function getLatestHolderDaily() {
  const supabase = getSupabase();
  const { data: latest, error } = await supabase
    .from("holder_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (latest.length === 0) return [];
  const { data, error: listError } = await supabase
    .from("holder_daily")
    .select(
      "id, date, symbol, chain, token_address, coingecko_id, tracked_since, wallets, active_wallets, new_wallets, top10_net_pct, top10_balance_pct, missed_blocks",
    )
    .eq("date", latest[0].date)
    .order("top10_net_pct", { ascending: false, nullsFirst: false });
  if (listError) throw listError;
  return data as HolderDailyRow[];
}
