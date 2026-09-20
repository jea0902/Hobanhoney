import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";
import RankerGrid from "@/components/rankers/RankerGrid";

export const dynamic = "force-dynamic";

export default function RankersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <AutoRefresh intervalMs={10000} />
      {/* 좌우 여백 배너 광고 자리 (구글 애드센스 승인 전까지는 자리만 예약) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-10 hidden w-32 items-center justify-center 2xl:flex"
      >
        <div className="pointer-events-auto flex h-64 w-28 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-600">
          광고 자리
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-0 z-10 hidden w-32 items-center justify-center 2xl:flex"
      >
        <div className="pointer-events-auto flex h-64 w-28 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-600">
          광고 자리
        </div>
      </div>
      <Navbar active="rankers" />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">
            실시간 랭커 포지션
          </h1>
          <p className="mb-4 text-sm text-gray-400">
            Hyperliquid에서 활동 중인 PNL 리더보드 TOP 20 안에 드는 고래 트레이더들의 실시간 포지션
            (2026.09.19 기준, 리더보드 PNL순)
          </p>
          <RankerGrid />
        </div>
      </section>

      <Footer />
    </div>
  );
}
