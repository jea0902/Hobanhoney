// 카드 안의 작은 수익률 추이 선. 축·숫자 없이 모양만 보여주므로 차트 라이브러리 없이 SVG로 그린다.
// 사이트 전체 규칙대로 수익은 빨강, 손실은 파랑.
export default function Sparkline({
  values,
  className = "",
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return <div className={className} />;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const y = (v: number) => 30 - ((v - min) / span) * 28 - 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v)}`).join(" ");
  const up = values.at(-1)! >= 0;
  const color = up ? "#EF4444" : "#3B82F6";

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      {/* 0% 기준선 — 입금한 돈 그대로인 지점 */}
      <line
        x1="0"
        x2="100"
        y1={y(0)}
        y2={y(0)}
        stroke="currentColor"
        strokeDasharray="2 2"
        className="text-gray-200 dark:text-gray-700"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
