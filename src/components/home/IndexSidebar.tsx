"use client";

import { useState } from "react";

const INDEX_ITEMS = [
  { name: "나스닥", price: "26,333.03", change: "+251.31 (0.96%)", isUp: true },
  { name: "S&P 500", price: "7,656.98", change: "+65.28 (0.85%)", isUp: true },
  { name: "달러 환율", price: "1,346.40", change: "+8.2 (0.61%)", isUp: true },
  { name: "VIX", price: "15.84", change: "-2.00 (11.21%)", isUp: false },
  { name: "코스피", price: "6,909.91", change: "-124.01 (1.76%)", isUp: false },
  { name: "나스닥100 선물", price: "26,410.50", change: "+180.20 (0.68%)", isUp: true },
  { name: "다우존스", price: "46,900.12", change: "+300.45 (0.65%)", isUp: true },
  { name: "필라델피아 반도체", price: "11,823.99", change: "+209.83 (1.80%)", isUp: true },
  { name: "비트코인", price: "105,216,000", change: "+36,000 (0.03%)", isUp: true },
  { name: "금", price: "3,652,000", change: "-8,200 (0.22%)", isUp: false },
];

export default function IndexSidebar() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="flex h-fit shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="사이드바 펼치기"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-2xl font-bold text-gray-500 hover:text-gray-900"
        >
          «
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 shrink-0 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">관심 지표</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="사이드바 접기"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-2xl font-bold text-gray-500 hover:text-gray-900"
        >
          »
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {INDEX_ITEMS.map((item) => (
          <li key={item.name} className="rounded-xl border border-gray-100 p-3">
            <p className="text-xs font-medium text-gray-500">{item.name}</p>
            <div className="mt-1 flex items-end justify-between">
              <Sparkline isUp={item.isUp} />
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{item.price}</p>
                <p className={`text-xs font-bold ${item.isUp ? "text-red-500" : "text-blue-500"}`}>
                  {item.change}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Sparkline({ isUp }: { isUp: boolean }) {
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none" aria-hidden="true">
      <polyline
        points="0,16 10,18 20,10 30,14 40,4 50,8 64,2"
        stroke={isUp ? "#ef4444" : "#3b82f6"}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
