import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import ContrarianSignal from "@/components/home/ContrarianSignal";
import Footer from "@/components/home/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티 | 호반꿀",
  description: "비트코인 역발상 신호등과, 준비 중인 커뮤니티 글쓰기 공간.",
};

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white pb-14 dark:bg-gray-950 lg:pb-0 lg:pl-56">
      <Navbar active="community" />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-6 xl:max-w-none">
        <ContrarianSignal />

        <section className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">커뮤니티</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            글을 쓰고 서로 의견을 나누는 공간을 준비 중임.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
