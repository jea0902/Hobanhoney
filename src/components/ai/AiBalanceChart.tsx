"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsDark } from "@/components/useIsDark";

// AI마다 색을 id로 고정한다 (화면 순서·순위가 바뀌어도 색은 그대로). [밝은 화면, 다크 모드]
// 사용자 요청으로 워뇨띠부터 버리까지 빨주노초파남보 (2026-10-17). 무지개 순서는 이웃한 색(빨↔주, 남↔보)이
// 색각 이상일 때 헷갈릴 수 있어(dataviz 검증: 정상 시력 ΔE 14.8, 색각 이상 7.3) 범례·툴팁 이름과 아래 표로 보완한다.
// 다크 모드는 어두운 배경에서 보이게 같은 색을 한 단계 밝게.
// AI 마틴은 검정(다크 모드는 흰색), AI 포트는 청록: 남은 후보 중 이웃 색과 덜 헷갈리는 쪽 (파랑과는 범례로 구분).
const COLORS: Record<string, [string, string]> = {
  wonyotti: ["#c92a2a", "#f03e3e"],
  hobanhoney: ["#f76707", "#ff922b"],
  wallstreet: ["#e0a800", "#fab005"],
  korean_ant: ["#2f9e44", "#40c057"],
  fear_greed: ["#1c7ed6", "#339af0"],
  buffett: ["#3b2fa8", "#7950f2"],
  burry: ["#ae3ec9", "#cc5de8"],
  martin: ["#343a40", "#f1f3f5"],
  port: ["#15aabf", "#3bc9db"],
};

function formatUsd(value: number) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatSignedUsd(value: number) {
  return `${value > 0 ? "+" : ""}${formatUsd(value)}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// 잔액: 모두 같은 돈을 넣어 같은 계단으로 올라가서 차이가 잘 안 보임 → 손익·수익률로 바꾸면 0 기준 위아래로 갈라진다.
const VIEWS = [
  { key: "equity", label: "잔액" },
  { key: "profit", label: "누적 손익" },
  { key: "return", label: "수익률" },
] as const;
type View = (typeof VIEWS)[number]["key"];

// 운영자 페이지 "잔액 추이"처럼 AI들을 한 그래프에 겹쳐서, 같은 돈을 넣고 누가 더 불렸는지 보이게 한다.
// 잔액 보기의 회색 점선은 모두가 똑같이 넣은 누적 입금 — 이 선보다 위면 번 것, 아래면 잃은 것.
// 회색 긴 점선은 같은 돈으로 나스닥100만 사 모았을 때(기준선) — AI가 그냥 지수 적립보다 나은지 비교한다.
export default function AiBalanceChart({
  ais,
  baseline,
  rows,
}: {
  ais: { id: string; name: string }[];
  baseline: { id: string; name: string };
  rows: Record<string, string | number | null>[];
}) {
  const [view, setView] = useState<View>("equity");
  const isDark = useIsDark();
  const tickColor = isDark ? "#9CA3AF" : "#6B7280";
  const series = [...ais, baseline];
  const baselineColor = isDark ? "#D1D5DB" : "#6B7280";
  const nameOf = (key: unknown) =>
    key === "invested" ? "누적 입금" : (series.find((s) => s.id === key)?.name ?? String(key));
  const format =
    view === "equity" ? formatUsd : view === "profit" ? formatSignedUsd : formatPercent;

  const data = rows.map((row) => {
    const date = String(row.date);
    const point: Record<string, string | number | null> = {
      label: `${date.slice(2, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)}`,
      invested: row.invested,
    };
    for (const ai of series) {
      const equity = row[ai.id] as number | null;
      const invested = row[`${ai.id}_invested`] as number | null;
      if (equity === null || invested === null) point[ai.id] = null;
      else if (view === "equity") point[ai.id] = equity;
      else if (view === "profit") point[ai.id] = equity - invested;
      // 첫 입금 전(넣은 돈 0)엔 수익률을 낼 수 없다
      else point[ai.id] = invested > 0 ? ((equity - invested) / invested) * 100 : null;
    }
    return point;
  });

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {VIEWS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setView(option.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === option.key
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid vertical={false} stroke={isDark ? "#1F2937" : "#F3F4F6"} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={format}
            />
            <Tooltip
              contentStyle={
                isDark
                  ? { backgroundColor: "#1F2937", border: "1px solid #374151", color: "#F3F4F6" }
                  : undefined
              }
              // 값이 큰 순서로 보여서 그날 누가 앞서는지 바로 보인다
              itemSorter={(item) => -Number(item.value ?? 0)}
              formatter={(value, name) => [
                value === null || value === undefined ? "—" : format(Number(value)),
                nameOf(name),
              ]}
            />
            <Legend
              // 기본은 이름순 정렬이라, 선 색과 같은 화면 순서로 고정한다
              itemSorter={(item) =>
                item.dataKey === "invested"
                  ? series.length
                  : series.findIndex((s) => s.id === item.dataKey)
              }
              formatter={(value) => (
                <span style={{ color: tickColor, fontSize: 12 }}>{nameOf(value)}</span>
              )}
            />
            {view === "equity" ? (
              <Line
                type="stepAfter"
                dataKey="invested"
                stroke={isDark ? "#6B7280" : "#9CA3AF"}
                strokeWidth={2}
                strokeDasharray="2 4"
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              // 손익·수익률 보기에선 0이 "넣은 돈 그대로" 기준선
              <ReferenceLine
                y={0}
                stroke={isDark ? "#6B7280" : "#9CA3AF"}
                strokeWidth={2}
                strokeDasharray="2 4"
              />
            )}
            <Line
              type="monotone"
              dataKey={baseline.id}
              stroke={baselineColor}
              strokeWidth={2.5}
              strokeDasharray="10 4"
              dot={false}
              isAnimationActive={false}
            />
            {ais.map((ai) => (
              <Line
                key={ai.id}
                type="monotone"
                dataKey={ai.id}
                stroke={COLORS[ai.id][isDark ? 1 : 0]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
