import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import MarketCalendar from "@/components/home/MarketCalendar";
import KeyIndicators from "@/components/home/KeyIndicators";
import Footer from "@/components/home/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이벤트 | 호반꿀",
  description: "이번 주·다음 주 증시 일정과 주요 경제 지표(금리·물가·고용·시장 분위기).",
};

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-white pb-14 dark:bg-gray-950 lg:pb-0 lg:pl-56">
      <Navbar active="events" />
      <main className="grid gap-8 px-6 py-6 xl:grid-cols-2">
        <MarketCalendar />
        <KeyIndicators />
      </main>
      <Footer />
    </div>
  );
}
