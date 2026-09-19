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
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="home" />
      <MarketTicker />
      <Hero />
      <PositionsSection />
      <KeyIndicators />
      <Footer />
    </div>
  );
}
