import PositionGrid from "./PositionGrid";

export default function PositionsSection() {
  return (
    <section className="px-6 py-6">
      <div className="mx-auto max-w-6xl xl:max-w-none">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
          실시간 포지션
          <span className="text-xs font-medium text-gray-400 sm:text-sm">
            <span className="hidden sm:inline">(2026.09.18부터 자동으로 추적 중인 데이터)</span>
            <span className="sm:hidden">(2026.09.18~)</span>
          </span>
        </h2>
        <PositionGrid />
      </div>
    </section>
  );
}
