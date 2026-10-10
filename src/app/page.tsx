import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import PositionsSection from "@/components/home/PositionsSection";
import AiTradersSection from "@/components/home/AiTradersSection";
import KeyIndicators from "@/components/home/KeyIndicators";
import MarketTicker from "@/components/home/MarketTicker";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="home" />
      <MarketTicker />
      {/* 넓은 화면(1280px 이상)은 오른쪽에 주요 지표 열을 두고, 좁으면 주요 지표가 맨 아래로 간다.
          주요 지표를 한 번만 그리려고 같은 요소를 grid 위치로 옮긴다. */}
      <div className="xl:mx-auto xl:grid xl:max-w-[1600px] xl:grid-cols-[minmax(0,1fr)_260px] xl:pr-6">
        <main className="min-w-0">
          <Hero />
          <PositionsSection />
          <AiTradersSection />
        </main>
        <KeyIndicators />
      </div>
      <Footer />
    </div>
  );
}
