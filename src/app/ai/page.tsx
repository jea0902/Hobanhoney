import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AiTradersSection from "@/components/home/AiTradersSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI 트레이더 | 호반꿀",
  description: "정해진 전략대로만 매매하는 AI 트레이더 6명의 보유 종목과 수익률.",
};

// AI 탭. 6명의 월별 성과를 한 그래프(색깔별 막대)로 비교하는 화면이 들어갈 자리 (TODO.md 20번).
// 그 전까지는 홈과 같은 AI 트레이더 표를 보여준다.
export default function AiPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar active="ai" />
      <main className="mx-auto max-w-6xl">
        <AiTradersSection />
      </main>
      <Footer />
    </div>
  );
}
