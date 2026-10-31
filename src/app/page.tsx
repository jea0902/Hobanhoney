import Navbar from "@/components/home/Navbar";
import MarketOverview from "@/components/home/MarketOverview";
import MarketMood from "@/components/home/MarketMood";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import PositionsSection from "@/components/home/PositionsSection";
import AiTradersSection from "@/components/home/AiTradersSection";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

// 위에서 아래로: 자산 가격 → 시장 분위기·이벤트 전(한 줄씩) → 실시간 포지션 → AI 트레이더.
// 증시 캘린더·경제 지표는 이벤트 메뉴로, 역발상 신호등은 커뮤니티 메뉴로, BTC 실시간 가격은 실시간 포지션 제목 오른쪽으로 옮김.
export default function Home() {
  return (
    <div className="min-h-screen bg-white pb-14 dark:bg-gray-950 lg:pb-0 lg:pl-56">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="home" />
      <main className="min-w-0">
        <MarketOverview />
        <MarketMood />
        <UpcomingEvents />
        <PositionsSection />
        <AiTradersSection />
      </main>
      <Footer />
    </div>
  );
}
