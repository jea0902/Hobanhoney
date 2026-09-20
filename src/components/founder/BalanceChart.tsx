"use client";

import { useEffect, useRef, useState } from "react";
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
import type { StoredCashFlow } from "@/lib/cashFlows";

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

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

// 그래프가 실제로 그려지는 픽셀 너비를 재서, 화면 크기에 안 겹치는 라벨 개수를 계산한다.
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export default function BalanceChart({
  snapshots,
  cashFlows,
}: {
  snapshots: BalanceSnapshot[];
  cashFlows: StoredCashFlow[];
}) {
  const isDark = useIsDark();
  const [chartWrapperRef, chartWidth] = useContainerWidth();

  if (snapshots.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        그래프 데이터를 모으는 중이에요 (6시간마다 자동 기록)
      </div>
    );
  }

  // 잔액 그래프가 시작하는 시점 이전의 입출금은 표시할 데이터 포인트가 없으니 제외한다.
  const chartStart = new Date(snapshots[0].recordedAt).getTime();
  const visibleCashFlows = cashFlows.filter(
    (flow) => new Date(flow.occurredAt).getTime() >= chartStart,
  );

  // 입출금 시점과 정확히 같은 날 스냅샷이 없을 수도 있으니, 가장 가까운 스냅샷의 인덱스에 표시한다.
  const depositIndexes = new Set<number>();
  const withdrawIndexes = new Set<number>();
  for (const flow of visibleCashFlows) {
    const flowTime = new Date(flow.occurredAt).getTime();
    let closestIndex = 0;
    let minDiff = Infinity;
    snapshots.forEach((snapshot, index) => {
      const diff = Math.abs(new Date(snapshot.recordedAt).getTime() - flowTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });
    (flow.type === "deposit" ? depositIndexes : withdrawIndexes).add(closestIndex);
  }

  // ReferenceDot은 카테고리 축과 잘 안 맞는 경우가 있어서, 대신 같은 데이터 배열에
  // "이 지점에 입금/출금이 있었다"는 필드를 심어 그 지점에만 점이 찍히는 Line을 하나 더 그린다.
  const data = snapshots.map((snapshot, index) => ({
    date: formatDateLabel(snapshot.recordedAt),
    equity: snapshot.totalEquity,
    depositDot: depositIndexes.has(index) ? snapshot.totalEquity : null,
    withdrawDot: withdrawIndexes.has(index) ? snapshot.totalEquity : null,
  }));

  const hasMarkers = depositIndexes.size > 0 || withdrawIndexes.size > 0;

  // "26.03.06" 라벨 하나가 대략 55px 필요 — 실제 라벨이 배치되는 플롯 영역(전체 너비에서
  // Y축 너비 60px + 좌우 여백을 뺀 부분) 기준으로 안 겹칠 개수만 보여준다.
  // (너비를 아직 못 쟀으면 일단 4개로 보수적으로 시작, 측정되는 즉시 재계산됨)
  const Y_AXIS_WIDTH = 60;
  const CHART_MARGIN_X = 10;
  const plotWidth = Math.max(0, chartWidth - Y_AXIS_WIDTH - CHART_MARGIN_X);
  const maxTicksThatFit = chartWidth > 0 ? Math.max(2, Math.floor(plotWidth / 55)) : 4;
  const desiredTicks = Math.min(8, maxTicksThatFit);
  const tickInterval = Math.max(0, Math.ceil(data.length / desiredTicks) - 1);

  // 카드 배경(dark:bg-gray-900 = #111827)이랑 똑같이 맞춰서 격자선이 안 보이게(있지만 안 튀게) 한다.
  const gridColor = isDark ? "#111827" : "#F3F4F6";
  const tickColor = isDark ? "#6B7280" : "#9CA3AF";
  const lineColor = isDark ? "#60A5FA" : "#3182F6";
  const dotStrokeColor = isDark ? "#111827" : "#FFFFFF";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div ref={chartWrapperRef} className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
              domain={[
                (min: number) => Math.max(0, Math.floor(min * 0.9)),
                (max: number) => Math.ceil(max * 1.05),
              ]}
            />
            <Tooltip
              contentStyle={
                isDark
                  ? { backgroundColor: "#1F2937", border: "1px solid #374151", color: "#F3F4F6" }
                  : undefined
              }
              formatter={(value) =>
                `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
              }
            />
            <Line type="monotone" dataKey="equity" stroke={lineColor} strokeWidth={2} dot={false} />
            <Line
              dataKey="depositDot"
              stroke="none"
              dot={{ r: 5, fill: "#EF4444", stroke: dotStrokeColor, strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              dataKey="withdrawDot"
              stroke="none"
              dot={{ r: 5, fill: "#3B82F6", stroke: dotStrokeColor, strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasMarkers && (
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> 입금
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> 출금
          </span>
        </div>
      )}
    </div>
  );
}
