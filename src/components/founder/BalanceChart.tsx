"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { BalanceSnapshot } from "@/lib/balanceSnapshots";

export default function BalanceChart({ snapshots }: { snapshots: BalanceSnapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
        그래프 데이터를 모으는 중이에요 (6시간마다 자동 기록)
      </div>
    );
  }

  const data = snapshots.map((snapshot) => ({
    date: new Date(snapshot.recordedAt).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }),
    equity: snapshot.totalEquity,
  }));

  return (
    <div className="h-64 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            width={60}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value) =>
              `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            }
          />
          <Line type="monotone" dataKey="equity" stroke="#3182F6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
