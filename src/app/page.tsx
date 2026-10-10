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
      {/* 넓은 화면(1280px 이상)은 화면 전체를 왼쪽 70% 본문, 오른쪽 30% 주요 지표로 나눈다.
          그보다 좁으면 70%가 포지션 표 최소 폭(720px)보다 좁아져서, 주요 지표를 맨 아래로 보낸다. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
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
