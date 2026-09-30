import Link from "next/link";
import PositionGrid from "./PositionGrid";

export default function PositionsSection() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-gray-100 sm:text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
          실시간 포지션
          <span className="text-gray-400">
            <span className="hidden sm:inline">
              (2026.09.18부터 자동으로 추적 중인 데이터)
            </span>
            <span className="sm:hidden">(2026.09.18~)</span>
          </span>
        </h2>
        <p className="-mt-2 mb-4 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
          유튜버가 방송에서 공개한 실제 포지션. 승률은 종료 수익률 +3% 이상 승, -3% 이하 패
          기준이야. 이름 누르면 전체 기록 볼 수 있어.{" "}
          <Link href="/guides/human-indicator" className="underline">
            인간지표란?
          </Link>
        </p>

        <PositionGrid />
      </div>
    </section>
  );
}
