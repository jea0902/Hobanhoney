"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// recharts 색상은 인라인 props라 Tailwind dark: 클래스가 안 먹혀서, <html> 클래스를 직접 감지한다.
function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// 잔고만 보면 출금할 때마다 꺾여 보여서, 누적 출금을 같이 그려 번 돈의 흐름이 보이게 한다.
export default function WonyottiBalanceChart({
  monthly,
}: {
  monthly: { month: string; balance: number; withdrawn: number }[];
}) {
  const isDark = useIsDark();
  const data = monthly.map((row) => ({
    month: `${row.month.slice(2, 4)}.${row.month.slice(5, 7)}`,
    balance: row.balance,
    withdrawn: row.withdrawn,
  }));
  const tickColor = isDark ? "#6B7280" : "#9CA3AF";
  const balanceColor = isDark ? "#60A5FA" : "#3182F6";
  const withdrawnColor = "#F59E0B";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#111827" : "#F3F4F6"} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={
                isDark
                  ? { backgroundColor: "#1F2937", border: "1px solid #374151", color: "#F3F4F6" }
                  : undefined
              }
              formatter={(value, name) => [
                `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })} BTC`,
                name === "balance" ? "월말 잔고" : "누적 출금",
              ]}
            />
            <Line
              type="monotone"
              dataKey="withdrawn"
              stroke={withdrawnColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke={balanceColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-blue-500" /> 월말 잔고
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-amber-500" /> 누적 출금
        </span>
      </div>
    </div>
  );
}
