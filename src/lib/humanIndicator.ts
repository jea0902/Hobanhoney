import { getSupabase } from "@/lib/supabase";
import { toKstMonth } from "@/lib/closedTrades";

// 월초에 1~2건 지고 바로 뽑히는 걸 막기 위한 최소 결과 건수
const MIN_RESULTS = 5;

export interface MonthlyHumanIndicator {
  month: string;
  traderName: string;
  traderImage: string | null;
  wins: number;
  draws: number;
  losses: number;
  reverseWinRate: number;
}

interface ResultRow {
  trader_name: string;
  trader_image: string | null;
  result: "win" | "draw" | "loss";
  result_recorded_at: string | null;
  created_at: string;
}

// "반대로 했으면 승률" = 패 ÷ (승 + 패). 무승부는 반대로 해도 무승부라 뺀다.
// 그 달 결과가 나온 포지션 기준으로 이 값이 가장 높은 트레이더를 고른다. 기록은 positions에 계속 남아서
// 지난달도 month만 바꾸면 다시 계산된다.
export async function getMonthlyHumanIndicator(
  month = toKstMonth(new Date().toISOString()),
): Promise<MonthlyHumanIndicator | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("positions")
    .select("trader_name, trader_image, result, result_recorded_at, created_at")
    .not("result", "is", null);
  const rows = ((data ?? []) as ResultRow[]).filter(
    (row) => toKstMonth(row.result_recorded_at ?? row.created_at) === month,
  );

  const candidates = [...new Set(rows.map((row) => row.trader_name))]
    .map((traderName) => {
      const traderRows = rows.filter((row) => row.trader_name === traderName);
      const wins = traderRows.filter((row) => row.result === "win").length;
      const draws = traderRows.filter((row) => row.result === "draw").length;
      const losses = traderRows.filter((row) => row.result === "loss").length;
      return {
        month,
        traderName,
        traderImage: traderRows.find((row) => row.trader_image)?.trader_image ?? null,
        wins,
        draws,
        losses,
        reverseWinRate: wins + losses > 0 ? (losses / (wins + losses)) * 100 : 0,
      };
    })
    .filter((c) => c.wins + c.draws + c.losses >= MIN_RESULTS && c.wins + c.losses > 0);

  // 동률이면 더 많이 진 쪽이 인간지표
  candidates.sort((a, b) => b.reverseWinRate - a.reverseWinRate || b.losses - a.losses);
  return candidates[0] ?? null;
}
