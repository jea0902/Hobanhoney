import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";
import RankerGrid from "@/components/rankers/RankerGrid";

export const dynamic = "force-dynamic";

export default function RankersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <AutoRefresh intervalMs={10000} />
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
          <p className="mb-4 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
            Hyperliquid는 모든 포지션이 블록체인에 공개돼서 실시간으로 볼 수 있어.{" "}
            <Link href="/guides/liquidation-price" className="underline">
              강제청산가 보는 법
            </Link>
          </p>
          <RankerGrid />
        </div>
      </section>

      <Footer />
    </div>
  );
}
