import { getSupabase } from "@/lib/supabase";

// scripts/holder-watch가 매일 남기는 종목별 보유자 쏠림 결론 (TODO 39번 B)
export interface HolderCoinRow {
  id: string;
  date: string;
  symbol: string;
  chains: string;
  price: number | null;
  circulating_supply: number | null;
  net100_amount: number;
  net100_balance_amount: number;
  holder100_amount: number;
  new_wallets: number;
  active_wallets: number;
  status: string;
  net100_change_7d: number | null;
  holder100_change_7d: number | null;
  price_change_7d: number | null;
  pumped_30d: boolean | null;
}

export const HOLDER_STATUSES = ["조용한 매집", "분산", "중립"] as const;

// 가장 최근 날짜의 종목별 결론. 결론이 난 종목(매집·분산)을 위로.
export async function getLatestHolderCoins() {
  const supabase = getSupabase();
  const { data: latest, error } = await supabase
    .from("holder_coin_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (latest.length === 0) return [];
  const { data, error: listError } = await supabase
    .from("holder_coin_daily")
    .select("*")
    .eq("date", latest[0].date)
    .order("net100_change_7d", { ascending: false, nullsFirst: false });
  if (listError) throw listError;
  const rank = (status: string) => {
    const i = HOLDER_STATUSES.indexOf(status as (typeof HOLDER_STATUSES)[number]);
    return i === -1 ? HOLDER_STATUSES.length : i;
  };
  return (data as HolderCoinRow[]).sort((a, b) => rank(a.status) - rank(b.status));
}

// 상태별로 결과가 채워진 날 수와 그중 30일 안 펌핑한 날 수
export async function getHolderStatusResults() {
  return Promise.all(
    HOLDER_STATUSES.map(async (status) => {
      const count = async (pumpedOnly: boolean) => {
        let query = getSupabase()
          .from("holder_coin_daily")
          .select("id", { count: "exact", head: true })
          .eq("status", status)
          .not("pumped_30d", "is", null);
        if (pumpedOnly) query = query.eq("pumped_30d", true);
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      };
      return { status, done: await count(false), pumped: await count(true) };
    }),
  );
}
