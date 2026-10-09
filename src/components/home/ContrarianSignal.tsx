import { CONTRARIAN_RULES, getBtcContrarianConditions } from "@/lib/contrarianSignal";

export default async function ContrarianSignal({
  youtuberLongCount,
  youtuberShortCount,
}: {
  youtuberLongCount: number;
  youtuberShortCount: number;
}) {
  const conditions = await getBtcContrarianConditions(youtuberLongCount, youtuberShortCount);
  const metCount = conditions.filter((condition) => condition.met === true).length;
  const status =
    metCount >= CONTRARIAN_RULES.greenMin
      ? { light: "🟢", text: "역발상 관심 구간", color: "text-green-600 dark:text-green-400" }
      : metCount === CONTRARIAN_RULES.greenMin - 1
        ? { light: "🟡", text: "지켜보기", color: "text-yellow-600 dark:text-yellow-400" }
        : { light: "⚪", text: "아직 아님", color: "text-gray-500 dark:text-gray-400" };

  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">역발상 신호등 · BTC</p>
        <p className={`text-sm font-bold ${status.color}`}>
          {status.light} {status.text} ({metCount}/{conditions.length})
        </p>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {conditions.map((condition) => (
          <li
            key={condition.label}
            className="flex items-baseline justify-between gap-3 text-xs sm:text-sm"
          >
            <span className="text-gray-700 dark:text-gray-300">
              {condition.met ? "✅" : "⬜"} {condition.label}
            </span>
            <span className="shrink-0 text-right text-gray-400">{condition.current}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-5 text-gray-400">
        개인들이 겁먹고 던질 때만 켜지게 보수적으로 잡았어. {conditions.length}개 중{" "}
        {CONTRARIAN_RULES.greenMin}개 이상이면 초록불. 바닥이라는 뜻도, 투자 권유도 아니야.
      </p>
    </div>
  );
}
