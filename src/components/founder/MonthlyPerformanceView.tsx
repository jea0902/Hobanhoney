"use client";

import { useState } from "react";

export interface MonthRow {
  month: string;
  profit: number;
  loss: number;
  total: number;
  seed: number;
  returnPercent: number | null;
}

function formatUsd(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function pnlColor(n: number) {
  if (n > 0) return "text-red-500";
  if (n < 0) return "text-blue-500";
  return "text-gray-400";
}

function monthLabel(month: string) {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

export default function MonthlyPerformanceView({
  rows,
  currentMonth,
}: {
  rows: MonthRow[];
  currentMonth: string;
}) {
  const [selectedMonth, setSelectedMonth] = useState(rows[0]?.month);
  const row = rows.find((r) => r.month === selectedMonth);
  if (!row) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-base font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {rows.map((r) => (
            <option key={r.month} value={r.month}>
              {monthLabel(r.month)}
              {r.month === currentMonth ? " (진행 중)" : ""}
            </option>
          ))}
        </select>
        <div className="text-right">
          <p className="text-xs text-gray-400">시드 대비 수익률</p>
          <p className={`text-2xl font-extrabold ${pnlColor(row.total)}`}>
            {row.returnPercent === null
              ? "—"
              : `${row.returnPercent > 0 ? "+" : ""}${row.returnPercent.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400">익절 (USDT)</p>
          <p className={`text-base font-semibold ${pnlColor(row.profit)}`}>
            {formatUsd(row.profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">손절 (USDT)</p>
          <p className={`text-base font-semibold ${pnlColor(row.loss)}`}>{formatUsd(row.loss)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">합계 (USDT)</p>
          <p className={`text-base font-bold ${pnlColor(row.total)}`}>{formatUsd(row.total)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">시드 (USDT)</p>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {row.seed.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
