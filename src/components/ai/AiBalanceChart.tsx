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
// dataviz 기본 팔레트의 1~7번 — 이웃한 색끼리 색각 이상이 있어도 구분되게 검증된 순서. 다크 모드는 같은 색의 다크용 단계.
const LIGHT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const DARK_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

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
