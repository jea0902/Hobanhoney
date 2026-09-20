import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import PositionsSection from "@/components/home/PositionsSection";
import KeyIndicators from "@/components/home/KeyIndicators";
import MarketTicker from "@/components/home/MarketTicker";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default function Home() {
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
      <Navbar active="home" />
      <MarketTicker />
      <Hero />
      <PositionsSection />
      <KeyIndicators />
      <Footer />
    </div>
  );
}
