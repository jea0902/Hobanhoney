import { getSupabase } from "@/lib/supabase";

// scripts/mm-watchlist가 매일 쌓는 MM 펌핑 관찰 후보 (TODO 39번 A-2)
export interface WatchlistRow {
  id: string;
  date: string;
  symbol: string;
  account_ratio_60d: number;
  top_ratio_60d: number;
  volume_30d: number;
  price: number;
  pumped_30d: boolean | null;
  max_close_37d: number | null;
}

// 가장 최근 기준일의 후보 목록
export async function getLatestWatchlist() {
  const supabase = getSupabase();
  const { data: latest, error } = await supabase
    .from("mm_watchlist")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (latest.length === 0) return [];
  const { data, error: listError } = await supabase
    .from("mm_watchlist")
    .select("*")
    .eq("date", latest[0].date)
    .order("account_ratio_60d", { ascending: false });
  if (listError) throw listError;
  return data as WatchlistRow[];
}

// 결과가 채워진 지난 후보 (펌핑한 것·안 한 것 모두). 최근 300건까지만 화면에 보인다.
export async function getWatchlistResults() {
  const { data, error } = await getSupabase()
    .from("mm_watchlist")
    .select("*")
    .not("pumped_30d", "is", null)
    .order("date", { ascending: false })
    .order("account_ratio_60d", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data as WatchlistRow[];
}

// 결과가 채워진 기록 중 30일 안에 펌핑이 시작된 비율. 행이 많아질 수 있어 개수만 센다.
export async function getWatchlistHitRate() {
  const count = async (pumpedOnly: boolean) => {
    let query = getSupabase()
      .from("mm_watchlist")
      .select("id", { count: "exact", head: true })
      .not("pumped_30d", "is", null);
    if (pumpedOnly) query = query.eq("pumped_30d", true);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };
  const done = await count(false);
  return { done, pumped: done === 0 ? 0 : await count(true) };
}
