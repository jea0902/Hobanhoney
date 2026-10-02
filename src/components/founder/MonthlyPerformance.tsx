import { getMonthSeed, toKstMonth } from "@/lib/closedTrades";
import type { MonthlyPnl } from "@/lib/closedTrades";
import type { StoredCashFlow } from "@/lib/cashFlows";
import type { BalanceSnapshot } from "@/lib/balanceSnapshots";
import MonthlyPerformanceView from "@/components/founder/MonthlyPerformanceView";
import type { MonthRow } from "@/components/founder/MonthlyPerformanceView";

const FIRST_MONTH = "2026-04";

function listMonths(from: string, to: string) {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  while (`${year}-${String(month).padStart(2, "0")}` <= to) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

// 계산은 서버에서 하고, 드롭다운 선택 상태만 클라이언트 컴포넌트(MonthlyPerformanceView)가 가진다.
// closedTrades.ts는 DB 코드를 포함하고 있어서 클라이언트 번들에 넣지 않기 위함.
export default function MonthlyPerformance({
  monthlyPnl,
  cashFlows,
  snapshots,
}: {
  monthlyPnl: MonthlyPnl[];
  cashFlows: StoredCashFlow[];
  // 시간순(오래된 것 먼저) 정렬이어야 그 달 첫 스냅샷이 월초 자산이 된다.
  snapshots: BalanceSnapshot[];
}) {
  const currentMonth = toKstMonth(new Date().toISOString());

  const rows: MonthRow[] = listMonths(FIRST_MONTH, currentMonth)
    .reverse()
    .map((month) => {
      const pnl = monthlyPnl.find((entry) => entry.month === month) ?? {
        month,
        profit: 0,
        loss: 0,
        total: 0,
      };
      const seed = getMonthSeed(month, snapshots, cashFlows);
      return { ...pnl, seed, returnPercent: seed > 0 ? (pnl.total / seed) * 100 : null };
    });

  return <MonthlyPerformanceView rows={rows} currentMonth={currentMonth} />;
}
