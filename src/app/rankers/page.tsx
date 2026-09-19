import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";
import RankerGrid from "@/components/rankers/RankerGrid";

export const dynamic = "force-dynamic";

export default function RankersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="rankers" />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-1 text-lg font-bold text-gray-900">실시간 랭커 포지션</h1>
          <p className="mb-4 text-sm text-gray-400">
            Hyperliquid에서 활동 중인 PNL 리더보드 TOP 20 안에 드는 고래 트레이더들의 실시간
            포지션(2026.09.19 기준 PNL 리더보드순)
          </p>
          <RankerGrid />
        </div>
      </section>

      <Footer />
    </div>
  );
}
