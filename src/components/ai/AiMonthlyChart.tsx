"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsDark } from "@/components/useIsDark";

// AI마다 색을 고정한다 (화면 순서 = 색 순서, 순위가 바뀌어도 색은 그대로).
// dataviz 기본 팔레트의 1~7번 — 나란히 놓인 색끼리 색각 이상이 있어도 구분되게 검증된 순서. 다크 모드는 같은 색의 다크용 단계.
const LIGHT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const DARK_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

function monthLabel(month: string) {
  return `${month.slice(2, 4)}.${month.slice(5, 7)}`;
}

export default function AiMonthlyChart({
  ais,
  rows,
}: {
  ais: { id: string; name: string }[];
  rows: Record<string, string | number | null>[];
}) {
  const isDark = useIsDark();
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const tickColor = isDark ? "#9CA3AF" : "#6B7280";
  const data = rows.map((row) => ({ ...row, label: monthLabel(String(row.month)) }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%" barGap={2}>
          <CartesianGrid vertical={false} stroke={isDark ? "#1F2937" : "#F3F4F6"} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: tickColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine y={0} stroke={isDark ? "#4B5563" : "#D1D5DB"} />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
            contentStyle={
              isDark
                ? { backgroundColor: "#1F2937", border: "1px solid #374151", color: "#F3F4F6" }
                : undefined
            }
            formatter={(value, name) => [
              value === null || value === undefined
                ? "—"
                : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%`,
              ais.find((ai) => ai.id === name)?.name ?? name,
            ]}
          />
          <Legend
            // 기본은 이름순 정렬이라, 막대·색과 같은 화면 순서로 고정한다
            itemSorter={(item) => ais.findIndex((ai) => ai.id === item.dataKey)}
            formatter={(value) => (
              <span style={{ color: tickColor, fontSize: 12 }}>
                {ais.find((ai) => ai.id === value)?.name ?? value}
              </span>
            )}
          />
          {ais.map((ai, i) => (
            <Bar
              key={ai.id}
              dataKey={ai.id}
              fill={colors[i]}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
