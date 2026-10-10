import Navbar from "@/components/home/Navbar";
import MarketCards from "@/components/home/MarketCards";
import Hero from "@/components/home/Hero";
import PositionsSection from "@/components/home/PositionsSection";
import AiTradersSection from "@/components/home/AiTradersSection";
import MarketCalendar from "@/components/home/MarketCalendar";
import KeyIndicators from "@/components/home/KeyIndicators";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

// 네이버 증권 홈을 본뜬 구성: 왼쪽 70%는 자산 가격 박스 → 인간지표 → 실시간 포지션 → AI 트레이더,
// 오른쪽 30%는 증시 캘린더 → 주요 지표. 1280px보다 좁으면 70%가 포지션 표 최소 폭(720px)보다
// 좁아져서 오른쪽 열을 맨 아래로 보낸다.
export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="home" />
      <div className="xl:grid xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <main className="min-w-0">
          <MarketCards />
          <Hero />
          <PositionsSection />
          <AiTradersSection />
        </main>
        <aside className="flex flex-col gap-8 px-6 py-6 xl:border-l xl:border-gray-100 xl:dark:border-gray-800">
          <MarketCalendar />
          <KeyIndicators />
        </aside>
      </div>
      <Footer />
    </div>
  );
}
