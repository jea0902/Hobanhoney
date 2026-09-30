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
              (2026.09.18부터 시간날 때마다 추적 중인 데이터)
            </span>
            <span className="sm:hidden">(2026.09.18~)</span>
          </span>
        </h2>
        <p className="-mt-2 mb-4 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
          트레이딩 방송을 하는 유튜버들이 화면에 공개한 실제 포지션이에요. 현재가는 Bybit 시세로
          실시간 계산하고, 누적 승률은 종료된 포지션의 수익률이 +3% 이상이면 승, -3% 이하이면 패로
          센 결과예요. 트레이더 이름을 누르면 지금까지의 전체 기록을 볼 수 있어요.{" "}
          <Link href="/guides/human-indicator" className="underline">
            인간지표란?
          </Link>
        </p>

        <PositionGrid />
      </div>
    </section>
  );
}
