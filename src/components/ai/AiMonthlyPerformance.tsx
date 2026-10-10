"use client";

import { useState } from "react";
import type { AiMonth } from "@/lib/aiInvestors";

function formatUsd(n: number, sign = false) {
  const prefix = sign && n > 0 ? "+" : "";
  return `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function pnlColor(n: number) {
  if (n > 0) return "text-red-500";
  if (n < 0) return "text-blue-500";
  return "text-gray-400";
}

function monthLabel(month: string) {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

// 운영자 페이지의 월별 성과(MonthlyPerformanceView)와 같은 모양. AI는 실현손익이 아니라
// 월말 자산 기준이라 익절/손절 대신 손익·시드·월말 자산을 보여준다.
export default function AiMonthlyPerformance({
  months,
  currentMonth,
}: {
  months: AiMonth[];
  currentMonth: string;
}) {
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.month);
  const row = months.find((m) => m.month === selectedMonth);
  if (!row) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-base font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {monthLabel(m.month)}
              {m.month === currentMonth ? " (진행 중)" : ""}
            </option>
          ))}
        </select>
        <div className="text-right">
          <p className="text-xs text-gray-400">시드 대비 수익률</p>
          <p className={`text-2xl font-extrabold ${pnlColor(row.pnl)}`}>
            {row.returnPercent === null
              ? "—"
              : `${row.returnPercent > 0 ? "+" : ""}${row.returnPercent.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-400">손익 (USD)</p>
          <p className={`text-base font-bold ${pnlColor(row.pnl)}`}>{formatUsd(row.pnl, true)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">시드 (USD)</p>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {formatUsd(row.seed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">
            {row.month === currentMonth ? "현재 자산" : "월말 자산"} (USD)
          </p>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {formatUsd(row.endEquity)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-gray-400">
        시드 = 월초 자산 + 그 달 입금 · 손익 = 월말 자산 − 시드
      </p>
    </div>
  );
}
