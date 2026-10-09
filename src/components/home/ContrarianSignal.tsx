import { getContrarianSignals, SIGNAL_RULES } from "@/lib/contrarianSignal";
import type { SignalCondition } from "@/lib/contrarianSignal";

const countMet = (conditions: SignalCondition[]) =>
  conditions.filter((condition) => condition.met === true).length;

function getLight(metCount: number) {
  if (metCount >= SIGNAL_RULES.greenMin) return "🟢";
  if (metCount >= SIGNAL_RULES.yellowMin) return "🟡";
  return "⚪";
}

export default async function ContrarianSignal() {
  const { bottom, top, accountRatio } = await getContrarianSignals();
  const bottomCount = countMet(bottom);
  const topCount = countMet(top);

  const summary =
    bottomCount >= SIGNAL_RULES.greenMin
      ? "저점 신호 켜짐 — 개인들이 겁먹었을 때"
      : topCount >= SIGNAL_RULES.greenMin
        ? "고점 신호 켜짐 — 개인들이 들떴을 때"
        : bottomCount >= SIGNAL_RULES.yellowMin
          ? "저점 쪽으로 기울어지는 중"
          : topCount >= SIGNAL_RULES.yellowMin
            ? "고점 쪽으로 기울어지는 중"
            : "중립";

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100 sm:text-base">
          역발상 신호등 · BTC
        </p>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">
          지금: {summary}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SignalSide
          title="저점 신호"
          hint="개인 공포 과잉"
          conditions={bottom}
          metCount={bottomCount}
          tone="blue"
          dimmed={topCount > bottomCount}
        />
        <SignalSide
          title="고점 신호"
          hint="개인 탐욕 과잉"
          conditions={top}
          metCount={topCount}
          tone="red"
          dimmed={bottomCount > topCount}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-400">
        {accountRatio &&
          `Bybit 계정 수 기준 롱 ${(accountRatio.longRatio * 100).toFixed(0)}% · 숏 ${(accountRatio.shortRatio * 100).toFixed(0)}%. `}
        4개 중 {SIGNAL_RULES.greenMin}개 이상이면 초록불. 바닥·꼭대기라는 뜻도, 투자 권유도 아니야.
      </p>
    </div>
  );
}

function SignalSide({
  title,
  hint,
  conditions,
  metCount,
  tone,
  dimmed,
}: {
  title: string;
  hint: string;
  conditions: SignalCondition[];
  metCount: number;
  tone: "blue" | "red";
  // 반대쪽이 더 많이 켜졌으면 흐리게 해서, 지금 어느 쪽에 가까운지 한눈에 보이게 한다.
  dimmed: boolean;
}) {
  const colors =
    tone === "blue"
      ? {
          box: "border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30",
          text: "text-blue-600 dark:text-blue-400",
          bar: "bg-blue-500",
        }
      : {
          box: "border-red-100 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30",
          text: "text-red-600 dark:text-red-400",
          bar: "bg-red-500",
        };

  return (
    <div
      className={`rounded-2xl border p-3 transition ${colors.box} ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-sm font-bold ${colors.text}`}>
          {getLight(metCount)} {title}
          <span className="ml-1 text-xs font-normal text-gray-400">{hint}</span>
        </p>
        <p className={`text-sm font-extrabold ${colors.text}`}>
          {metCount}/{conditions.length}
        </p>
      </div>
      <div className="mt-2 flex gap-1">
        {conditions.map((condition) => (
          <span
            key={condition.label}
            className={`h-1.5 flex-1 rounded-full ${condition.met ? colors.bar : "bg-gray-200 dark:bg-gray-700"}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {conditions.map((condition) => (
          <li key={condition.label} className="flex items-baseline justify-between gap-3 text-xs">
            <span
              className={
                condition.met ? `font-semibold ${colors.text}` : "text-gray-600 dark:text-gray-400"
              }
            >
              {condition.met ? "●" : "○"} {condition.label}
            </span>
            <span className="shrink-0 text-right text-gray-400">{condition.current}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
