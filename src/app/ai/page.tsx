import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AiTradersSection from "@/components/home/AiTradersSection";
import AiBalanceChart from "@/components/ai/AiBalanceChart";
import {
  AI_TRADERS,
  getEquityTimeline,
  getMonthlyReturnsByAi,
  NASDAQ_BASELINE,
} from "@/lib/aiInvestors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI 트레이더 | 호반꿀",
  description: "정해진 전략대로만 매매하는 AI 트레이더들의 월별 성과 비교, 보유 종목과 수익률.",
};

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function AiPage() {
  const [timeline, rows] = await Promise.all([getEquityTimeline(), getMonthlyReturnsByAi()]);
  const ais = AI_TRADERS.map((ai) => ({ id: ai.id, name: ai.name }));

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar active="ai" />
      <main className="mx-auto max-w-6xl">
        <section className="px-6 pt-6">
          <h1 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
            AI 잔액 추이
          </h1>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            모두 2026-03-06부터 매월 10일 100만원씩 똑같이 입금. 잔액은 회색 점선(누적 입금), 누적
            손익·수익률은 0 기준선보다 위면 번 것, 아래면 잃은 것. 회색 긴 점선은 같은 돈으로
            나스닥100(QQQ)만 매월 사 모았을 때로, 이보다 위면 지수 적립보다 나은 것.
          </p>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <AiBalanceChart ais={ais} baseline={NASDAQ_BASELINE} rows={timeline} />
          </div>

          <h2 className="mb-1 mt-8 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
            AI 월별 성과
          </h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            달마다 시드(월초 자산 + 그 달 입금) 대비 수익률.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">월</th>
                  {ais.map((ai) => (
                    <th
                      key={ai.id}
                      className="whitespace-nowrap px-3 py-2.5 text-right font-medium"
                    >
                      {ai.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((row) => (
                  <tr
                    key={String(row.month)}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700 dark:text-gray-300">
                      {String(row.month).slice(0, 4)}년 {Number(String(row.month).slice(5, 7))}월
                    </td>
                    {ais.map((ai) => {
                      const value = row[ai.id] as number | null;
                      const color =
                        value === null
                          ? "text-gray-300 dark:text-gray-600"
                          : value >= 0
                            ? "text-red-500"
                            : "text-blue-500";
                      return (
                        <td
                          key={ai.id}
                          className={`whitespace-nowrap px-3 py-2.5 text-right ${color}`}
                        >
                          {formatPercent(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AiTradersSection />
      </main>
      <Footer />
    </div>
  );
}
