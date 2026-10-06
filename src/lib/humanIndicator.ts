import { getSupabase } from "@/lib/supabase";
import { toKstMonth } from "@/lib/closedTrades";
import { getMarkPrice } from "@/lib/bybit";
import { getUnrealizedPnl, getReturnRatePercent } from "@/lib/positionMath";
import { UNTRACKED_TRADERS } from "@/lib/traderGroups";
import type { PositionRow } from "@/types/position";

export interface MonthlyHumanIndicator {
  traderName: string;
  traderImage: string | null;
  returnPercent: number;
}

// 이번 달 수익률 합계가 가장 낮은 트레이더.
// 합계 = 이번 달 결과가 나온 포지션의 결과 수익률 + 지금 열린 포지션의 미실현 수익률.
// 승률만 보면 크게 물린 채 버티는 트레이더(결과 0건)를 못 잡아서 미실현까지 넣는다.
// 열린 포지션은 언제 열었든 현재 미실현 수익률 전체를 넣는다(월초 가격 기록이 없어서).
export async function getMonthlyHumanIndicator(): Promise<MonthlyHumanIndicator | null> {
  const month = toKstMonth(new Date().toISOString());
  const supabase = getSupabase();
  const { data } = await supabase.from("positions").select("*");
  // 자동 추적이 안 되는 트레이더는 이번 달 기록이 실제와 달라서 후보에서 뺀다.
  const rows = ((data ?? []) as PositionRow[]).filter((row) => !UNTRACKED_TRADERS[row.trader_name]);

  const closedThisMonth = rows.filter(
    (row) => row.result && toKstMonth(row.result_recorded_at ?? row.created_at) === month,
  );
  const openActual = rows.filter((row) => !row.result && row.type === "actual");

  const openReturns = await Promise.all(
    openActual.map(async (row) => {
      const markPrice = await getMarkPrice(row.symbol!);
      if (markPrice === null) return { row, returnPercent: 0 };
      const pnl = getUnrealizedPnl(row.direction, row.quantity!, row.entry_price!, markPrice);
      return {
        row,
        returnPercent: getReturnRatePercent(pnl, row.quantity!, row.entry_price!, row.leverage!),
      };
    }),
  );

  const traderNames = [
    ...new Set([...closedThisMonth, ...openActual].map((row) => row.trader_name)),
  ];
  const candidates = traderNames.map((traderName) => {
    const closedSum = closedThisMonth
      .filter((row) => row.trader_name === traderName)
      .reduce((sum, row) => sum + Number(row.result_pnl_percent ?? 0), 0);
    const openSum = openReturns
      .filter(({ row }) => row.trader_name === traderName)
      .reduce((sum, { returnPercent }) => sum + returnPercent, 0);
    return {
      traderName,
      traderImage:
        rows.find((row) => row.trader_name === traderName && row.trader_image)?.trader_image ??
        null,
      returnPercent: closedSum + openSum,
    };
  });

  candidates.sort((a, b) => a.returnPercent - b.returnPercent);
  return candidates[0] ?? null;
}
