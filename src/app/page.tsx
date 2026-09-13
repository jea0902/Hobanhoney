import Navbar from "@/components/home/Navbar";
import NoticeBanner from "@/components/home/NoticeBanner";
import MarketStatusBar from "@/components/home/MarketStatusBar";
import PositionGrid from "@/components/home/PositionGrid";
import IndexSidebar from "@/components/home/IndexSidebar";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <AutoRefresh intervalMs={10000} />
      <Navbar />
      <NoticeBanner />

      <div className="flex gap-6 p-6">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <MarketStatusBar />
          <PositionGrid />
        </main>

        <IndexSidebar />
      </div>
    </div>
  );
}
