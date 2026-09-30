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
            Hyperliquid는 모든 계정의 포지션이 블록체인에 공개되는 거래소라서, 실제로 돈을 가장 많이
            번 계정들이 지금 무엇을 들고 있는지 그대로 볼 수 있어요. 유튜버 트레이더의 포지션(홈)과
            비교해서, 수익을 낸 고래들이 롱과 숏 중 어느 쪽에 서 있는지 확인해 보세요. 레버리지와
            강제청산가 읽는 법은{" "}
            <Link href="/guides/liquidation-price" className="underline">
              강제청산가 가이드
            </Link>
            에 정리해 두었어요.
          </p>
          <RankerGrid />
        </div>
      </section>

      <Footer />
    </div>
  );
}
