import { toKstMonth } from "@/lib/closedTrades";
import type { MonthlyPnl } from "@/lib/closedTrades";
import type { StoredCashFlow } from "@/lib/cashFlows";
import MonthlyPerformanceView from "@/components/founder/MonthlyPerformanceView";
import type { MonthRow } from "@/components/founder/MonthlyPerformanceView";

const FIRST_MONTH = "2026-04";
// 계정 입출금 기록엔 추적 이전(2024~2025) 내역도 섞여 있어서, 추적 시작일(26.03.06 KST) 이후만 시드로 센다.
const TRACKING_START = new Date("2026-03-06T00:00:00+09:00").getTime();

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
}: {
  monthlyPnl: MonthlyPnl[];
  cashFlows: StoredCashFlow[];
}) {
  const currentMonth = toKstMonth(new Date().toISOString());
  const seedFlows = cashFlows.filter(
    (flow) => flow.coin === "USDT" && new Date(flow.occurredAt).getTime() >= TRACKING_START,
  );

  const rows: MonthRow[] = listMonths(FIRST_MONTH, currentMonth)
    .reverse()
    .map((month) => {
      const pnl = monthlyPnl.find((entry) => entry.month === month) ?? {
        month,
        profit: 0,
        loss: 0,
        total: 0,
      };
      // 전체 시드 = 그 달 말까지 넣은 돈 − 뺀 돈 (누적 순입금)
      const seed = seedFlows
        .filter((flow) => toKstMonth(flow.occurredAt) <= month)
        .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
      return { ...pnl, seed, returnPercent: seed > 0 ? (pnl.total / seed) * 100 : null };
    });

  return <MonthlyPerformanceView rows={rows} currentMonth={currentMonth} />;
}
