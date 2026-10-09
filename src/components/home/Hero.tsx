import Link from "next/link";
import { getMonthlyHumanIndicator } from "@/lib/humanIndicator";
import type { MonthlyHumanIndicator } from "@/lib/humanIndicator";
import ContrarianSignal from "@/components/home/ContrarianSignal";
import BtcLivePrice from "@/components/home/BtcLivePrice";

export default async function Hero() {
  const humanIndicator = await getMonthlyHumanIndicator();

  return (
    <section className="relative overflow-hidden px-6 py-8 sm:py-10">
      <DecorativeOrb />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          {/* 모바일은 공간이 좁아서 가격을 제목 아래로, PC는 제목 오른쪽에 둔다. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-10">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-800 dark:text-gray-300">
                인간지표 추적 사이트
              </p>
              <h1 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                인간지표 트레이더들의
                <br />
                실시간 포지션 추적
              </h1>
            </div>
            <BtcLivePrice />
          </div>

          <HumanIndicatorOfMonth humanIndicator={humanIndicator} />
        </div>

        <ContrarianSignal />
      </div>
    </section>
  );
}

function HumanIndicatorOfMonth({
  humanIndicator,
}: {
  humanIndicator: MonthlyHumanIndicator | null;
}) {
  const monthNumber = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
  });

  if (!humanIndicator) {
    return (
      <div className="flex shrink-0 flex-col items-center text-center">
        <p className="text-xs font-black text-gray-900 dark:text-gray-100 sm:text-sm">
          {monthNumber}의 인간지표
        </p>
        <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-yellow-400 text-xl text-gray-300 sm:h-16 sm:w-16">
          ?
        </div>
        <p className="mt-1 text-[11px] text-gray-400">기록 없음</p>
      </div>
    );
  }

  const { traderName, traderImage, returnPercent } = humanIndicator;

  return (
    <Link
      href={`/traders/${encodeURIComponent(traderName)}`}
      title="이번 달 종료 수익률 + 미실현 수익률 합계 꼴찌"
      className="group flex shrink-0 items-center gap-3"
    >
      <div className="relative mt-4">
        <span
          aria-hidden="true"
          className="absolute -top-5 left-1/2 -translate-x-1/2 -rotate-12 text-2xl drop-shadow sm:-top-6 sm:text-3xl"
        >
          👑
        </span>
        {traderImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 외부 URL을 입력하므로 next/image 도메인 화이트리스트 없이 처리
          <img
            src={traderImage}
            alt={traderName}
            className="h-14 w-14 rounded-full object-cover shadow-md ring-2 ring-yellow-400 transition group-hover:scale-105 sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-500 text-xl font-bold text-white shadow-md ring-2 ring-yellow-400 sm:h-20 sm:w-20 sm:text-2xl">
            {traderName.charAt(0)}
          </div>
        )}
      </div>
      <div className="text-left">
        <p className="text-[11px] font-black text-gray-900 dark:text-gray-100 sm:text-xs">
          {monthNumber}의 인간지표
        </p>
        <p className="text-base font-extrabold text-gray-900 dark:text-gray-100 sm:text-lg">
          {traderName}
        </p>
        <p
          className={`text-sm font-extrabold ${returnPercent < 0 ? "text-blue-500" : "text-red-500"}`}
        >
          {returnPercent > 0 ? "+" : ""}
          {returnPercent.toFixed(0)}%
        </p>
      </div>
    </Link>
  );
}

function DecorativeOrb() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 sm:-right-8"
    >
      {/* 궤도 링 */}
      <div className="absolute inset-0 rotate-[-20deg] rounded-full border border-blue-200/70" />
      {/* 유리구슬 */}
      <div
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-[1px]"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(219,234,254,0.85) 35%, rgba(147,197,253,0.55) 65%, rgba(191,219,254,0.15) 100%)",
        }}
      />
      {/* 작은 위성 점 */}
      <span className="absolute right-6 top-12 h-2.5 w-2.5 rounded-full bg-blue-300/80" />
      {/* 전체 후광 블러 */}
      <div className="absolute inset-0 -z-10 rounded-full bg-blue-100 opacity-60 blur-3xl" />
    </div>
  );
}
