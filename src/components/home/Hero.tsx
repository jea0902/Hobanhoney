import Link from "next/link";
import { getMonthlyHumanIndicator } from "@/lib/humanIndicator";
import type { MonthlyHumanIndicator } from "@/lib/humanIndicator";

export default async function Hero() {
  const humanIndicator = await getMonthlyHumanIndicator();

  return (
    <section className="relative overflow-hidden px-6 py-20">
      <DecorativeOrb />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-800 dark:text-gray-300">
            인간지표 추적 사이트
          </p>
          <h1 className="mt-3 text-2xl font-extrabold leading-[1.15] tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
            인간지표 트레이더들의
            <br />
            실시간 포지션 추적
          </h1>
        </div>

        <HumanIndicatorOfMonth humanIndicator={humanIndicator} />
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
      <div className="flex flex-col items-center text-center sm:mr-8">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {monthNumber}의 인간지표
        </p>
        <div className="mt-3 flex h-40 w-40 items-center justify-center rounded-full border-4 border-dashed border-yellow-400 text-4xl text-gray-300">
          ?
        </div>
        <p className="mt-3 text-xs text-gray-400">이번 달 기록 없음</p>
      </div>
    );
  }

  const { traderName, traderImage, returnPercent } = humanIndicator;

  return (
    <Link
      href={`/traders/${encodeURIComponent(traderName)}`}
      className="group flex flex-col items-center text-center sm:mr-8"
    >
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{monthNumber}의 인간지표</p>
      <div className="relative mt-8">
        <span
          aria-hidden="true"
          className="absolute -top-12 left-1/2 -translate-x-1/2 -rotate-12 text-6xl drop-shadow-md sm:-top-14 sm:text-7xl"
        >
          👑
        </span>
        {traderImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 외부 URL을 입력하므로 next/image 도메인 화이트리스트 없이 처리
          <img
            src={traderImage}
            alt={traderName}
            className="h-40 w-40 rounded-full object-cover shadow-xl ring-4 ring-yellow-400 transition group-hover:scale-105 sm:h-52 sm:w-52"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gray-500 text-5xl font-bold text-white shadow-xl ring-4 ring-yellow-400 sm:h-52 sm:w-52">
            {traderName.charAt(0)}
          </div>
        )}
      </div>
      <p className="mt-4 text-2xl font-extrabold text-gray-900 dark:text-gray-100">{traderName}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        이번 달 수익률{" "}
        <span
          className={`text-lg font-extrabold ${returnPercent < 0 ? "text-blue-500" : "text-red-500"}`}
        >
          {returnPercent > 0 ? "+" : ""}
          {returnPercent.toFixed(0)}%
        </span>
      </p>
      <p className="text-xs text-gray-400">종료 수익률 + 미실현 수익률 합계 꼴찌</p>
    </Link>
  );
}

function DecorativeOrb() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -top-28 h-[26rem] w-[26rem] sm:-right-8"
    >
      {/* 궤도 링 */}
      <div className="absolute inset-0 rotate-[-20deg] rounded-full border border-blue-200/70" />
      {/* 유리구슬 */}
      <div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-[1px]"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(219,234,254,0.85) 35%, rgba(147,197,253,0.55) 65%, rgba(191,219,254,0.15) 100%)",
        }}
      />
      {/* 작은 위성 점 */}
      <span className="absolute right-6 top-16 h-3 w-3 rounded-full bg-blue-300/80" />
      {/* 전체 후광 블러 */}
      <div className="absolute inset-0 -z-10 rounded-full bg-blue-100 opacity-60 blur-3xl" />
    </div>
  );
}
