"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsDark } from "@/components/useIsDark";

// AI마다 색을 고정한다 (화면 순서 = 색 순서, 순위가 바뀌어도 색은 그대로).
// 사용자 요청으로 워뇨띠부터 버리까지 빨주노초파남보 (2026-10-17). 무지개 순서는 이웃한 색(빨↔주, 남↔보)이
// 색각 이상일 때 헷갈릴 수 있어(dataviz 검증: 정상 시력 ΔE 14.8, 색각 이상 7.3) 범례·툴팁 이름과 아래 표로 보완한다.
// 다크 모드는 어두운 배경에서 보이게 같은 색을 한 단계 밝게.
const LIGHT_COLORS = ["#c92a2a", "#f76707", "#e0a800", "#2f9e44", "#1c7ed6", "#3b2fa8", "#ae3ec9"];
const DARK_COLORS = ["#f03e3e", "#ff922b", "#fab005", "#40c057", "#339af0", "#7950f2", "#cc5de8"];

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// 운영자 페이지 "잔액 추이"처럼 AI들의 총자산을 한 그래프에 겹쳐서, 같은 돈을 넣고 누가 더 불렸는지 보이게 한다.
// 회색 점선은 모두가 똑같이 넣은 누적 입금 — 이 선보다 위면 번 것, 아래면 잃은 것.
export default function AiBalanceChart({
  ais,
  rows,
}: {
  ais: { id: string; name: string }[];
  rows: Record<string, string | number | null>[];
}) {
  const isDark = useIsDark();
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const tickColor = isDark ? "#9CA3AF" : "#6B7280";
  const nameOf = (key: unknown) =>
    key === "invested" ? "누적 입금" : (ais.find((ai) => ai.id === key)?.name ?? String(key));
  const data = rows.map((row) => {
    const date = String(row.date);
    return { ...row, label: `${date.slice(2, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)}` };
  });

  return (
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
            width={60}
            tickFormatter={formatUsd}
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
              value === null ? "—" : formatUsd(Number(value)),
              nameOf(name),
            ]}
          />
          <Legend
            // 기본은 이름순 정렬이라, 선 색과 같은 화면 순서로 고정한다
            itemSorter={(item) =>
              item.dataKey === "invested"
                ? ais.length
                : ais.findIndex((ai) => ai.id === item.dataKey)
            }
            formatter={(value) => (
              <span style={{ color: tickColor, fontSize: 12 }}>{nameOf(value)}</span>
            )}
          />
          <Line
            type="stepAfter"
            dataKey="invested"
            stroke={isDark ? "#6B7280" : "#9CA3AF"}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          {ais.map((ai, i) => (
            <Line
              key={ai.id}
              type="monotone"
              dataKey={ai.id}
              stroke={colors[i]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
