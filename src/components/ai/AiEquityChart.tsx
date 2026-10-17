"use client";

import { useIsDark } from "@/components/useIsDark";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiEquity } from "@/lib/aiInvestors";

// 총자산과 누적 입금을 같이 그려서, 두 선의 간격이 곧 손익으로 보이게 한다.
export default function AiEquityChart({ equity }: { equity: AiEquity[] }) {
  const isDark = useIsDark();
  if (equity.length < 2) return null;

  const data = equity.map((row) => ({
    date: `${row.date.slice(2, 4)}.${row.date.slice(5, 7)}.${row.date.slice(8, 10)}`,
    equity: row.equity,
    invested: row.invested,
    withdrawn: row.withdrawn,
  }));
  // 출금하는 AI(워뇨띠)만 누적 출금 선을 그린다 — 총자산이 줄어든 게 손실이 아니라 챙긴 돈임을 보여준다
  const hasWithdrawals = equity.some((row) => row.withdrawn > 0);
  const tickColor = isDark ? "#6B7280" : "#9CA3AF";
  const equityColor = isDark ? "#60A5FA" : "#3182F6";
  const investedColor = isDark ? "#4B5563" : "#D1D5DB";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#111827" : "#F3F4F6"} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={
                isDark
                  ? { backgroundColor: "#1F2937", border: "1px solid #374151", color: "#F3F4F6" }
                  : undefined
              }
              formatter={(value, name) => [
                `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
                name === "equity" ? "총자산" : name === "invested" ? "누적 입금" : "누적 출금",
              ]}
            />
            <Line
              type="stepAfter"
              dataKey="invested"
              stroke={investedColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {hasWithdrawals && (
              <Line
                type="stepAfter"
                dataKey="withdrawn"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="equity"
              stroke={equityColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-blue-500" /> 총자산
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-gray-300 dark:bg-gray-600" /> 누적 입금
        </span>
        {hasWithdrawals && (
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-amber-500" /> 누적 출금
          </span>
        )}
      </div>
    </div>
  );
}
