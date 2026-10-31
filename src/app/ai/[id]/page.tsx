import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { assignTiers, TierEmblem } from "@/components/ai/AiTier";
import AiEquityChart from "@/components/ai/AiEquityChart";
import AiMonthlyPerformance from "@/components/ai/AiMonthlyPerformance";
import AiName from "@/components/ai/AiName";
import WonyottiRecord from "@/components/ai/WonyottiRecord";
import {
  AI_TRADERS,
  annualReturnPercent,
  displayAiSymbol,
  getAiDetail,
  getAiSummaries,
  getMonthlyPerformance,
  lastYearEndOf,
  isKrwSymbol,
} from "@/lib/aiInvestors";
import type { AiTrade } from "@/lib/aiInvestors";
import { toKstMonth } from "@/lib/closedTrades";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const meta = AI_TRADERS.find((ai) => ai.id === params.id);
  if (!meta) return {};
  const title = meta.seoTitle ?? `${meta.name} 전략과 포지션 | 호반꿀`;
  const description = `${meta.name}: ${meta.summary}. 전략 규칙, 보유 종목, 월별 성과, 매매 기록.`;
  // openGraph를 따로 안 주면 카톡·SNS 미리보기에 레이아웃의 사이트 제목이 그대로 나온다.
  return {
    title,
    description,
    openGraph: { title, description, siteName: "호반꿀", locale: "ko_KR", type: "website" },
  };
}

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPrice(price: number, symbol: string) {
  if (isKrwSymbol(symbol)) return `${Math.round(price).toLocaleString("ko-KR")}원`;
  return price >= 1
    ? price.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : price.toPrecision(4);
}

function formatQuantity(n: number) {
  return Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// 주식은 종가 기준이라 날짜만, 선물 AI(호반꿀·워뇨띠)는 진입·종료 시각까지 보여준다.
function formatTradeTime(iso: string, withTime: boolean) {
  if (!withTime) return iso.slice(0, 10);
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sideLabel(trade: AiTrade, isFutures: boolean) {
  if (isFutures) {
    return { buy: "롱 진입", sell: "롱 청산", short: "숏 진입", cover: "숏 청산" }[trade.side];
  }
  return { buy: "매수", sell: "매도", short: "공매도", cover: "공매도 청산" }[trade.side];
}

function sideColor(side: AiTrade["side"]) {
  return side === "buy" || side === "cover" ? "text-red-500" : "text-blue-500";
}

export default async function AiTraderPage({ params }: { params: { id: string } }) {
  const [detail, summaries] = await Promise.all([getAiDetail(params.id), getAiSummaries()]);
  if (!detail) notFound();
  // 홈 카드와 같은 티어 (올해 수익률 순위)
  const tier = assignTiers(
    summaries.map((s) => ({ id: s.meta.id, annualReturn: s.annualReturn })),
  ).get(params.id)!;
  const { meta, equity, holdings, trades } = detail;
  const isFutures = meta.id === "hobanhoney" || meta.id === "wonyotti" || meta.id === "martin";

  const latest = equity.at(-1);
  const returnPercent = latest ? annualReturnPercent(latest, lastYearEndOf(equity, latest)) : null;
  const returnColor =
    returnPercent === null
      ? "text-gray-400"
      : returnPercent >= 0
        ? "text-red-500"
        : "text-blue-500";
  const sortedHoldings = holdings.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="min-h-screen bg-white pb-14 dark:bg-gray-950 lg:pb-0 lg:pl-56">
      <Navbar active="ai" />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section>
          <p className="text-xs font-semibold tracking-[0.2em] text-indigo-500">AI 트레이더</p>
          <div className="mt-2 flex items-center gap-4">
            <TierEmblem tier={tier} size="lg" />
            <div>
              <h1>
                <AiName name={meta.name} className="text-3xl sm:text-4xl" />
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.summary}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label={`연 수익률${latest ? ` (${latest.date.slice(0, 4)}년)` : ""}`}>
              <span className={returnColor}>
                {returnPercent === null
                  ? "—"
                  : `${returnPercent > 0 ? "+" : ""}${returnPercent.toFixed(2)}%`}
              </span>
            </SummaryCard>
            <SummaryCard label="총자산">{latest ? formatUsd(latest.equity) : "—"}</SummaryCard>
            <SummaryCard label="누적 입금">{latest ? formatUsd(latest.invested) : "—"}</SummaryCard>
            {/* 출금하는 AI(2026-10-17 이후 지금은 없음)는 챙긴 돈이 더 중요해서 현금 대신 누적 출금을 보여준다 */}
            {latest && latest.withdrawn > 0 ? (
              <SummaryCard label="누적 출금">{formatUsd(latest.withdrawn)}</SummaryCard>
            ) : (
              <SummaryCard label="현금">{latest ? formatUsd(latest.cash) : "—"}</SummaryCard>
            )}
          </div>
          {latest && <p className="mt-2 text-xs text-gray-400">{latest.date} 기준</p>}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">전략</h2>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-gray-700 dark:text-gray-300">
            {meta.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">{meta.note}</p>
        </section>

        {meta.id === "wonyotti" && <WonyottiRecord />}

        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">자산 추이</h2>
          <AiEquityChart equity={equity} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">월별 성과</h2>
          <AiMonthlyPerformance
            months={getMonthlyPerformance(equity)}
            currentMonth={toKstMonth(new Date().toISOString())}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">
            보유 종목 ({holdings.length})
          </h2>
          {sortedHoldings.length === 0 ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
              현재 현금만 보유
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                    <th className="px-4 py-3 text-left font-medium">종목</th>
                    <th className="px-4 py-3 text-right font-medium">방향</th>
                    <th className="px-4 py-3 text-right font-medium">수량</th>
                    <th className="px-4 py-3 text-right font-medium">평균단가</th>
                    <th className="px-4 py-3 text-right font-medium">평가액</th>
                    <th className="px-4 py-3 text-right font-medium">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((holding) => {
                    const isShort = holding.quantity < 0;
                    return (
                      <tr
                        key={`${holding.symbol}-${holding.openedAt}`}
                        className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                          {displayAiSymbol(holding.symbol)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-bold ${isShort ? "text-blue-500" : "text-red-500"}`}
                        >
                          {isShort ? "숏" : "롱"}
                          {holding.leverage ? ` ${holding.leverage}x` : ""}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatQuantity(holding.quantity)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatPrice(holding.avgPrice, holding.symbol)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatUsd(Math.abs(holding.value))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                          {latest && latest.equity > 0
                            ? `${((Math.abs(holding.value) / latest.equity) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">
            매매 기록 (최근 {trades.length}건)
          </h2>
          <div className="max-h-[560px] overflow-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-3 text-left font-medium">{isFutures ? "시각" : "날짜"}</th>
                  <th className="px-4 py-3 text-left font-medium">종목</th>
                  <th className="px-4 py-3 text-left font-medium">구분</th>
                  <th className="px-4 py-3 text-right font-medium">수량</th>
                  <th className="px-4 py-3 text-right font-medium">가격</th>
                  <th className="px-4 py-3 text-left font-medium">이유</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {formatTradeTime(trade.tradedAt, isFutures)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">
                      {displayAiSymbol(trade.symbol)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-2.5 font-bold ${sideColor(trade.side)}`}
                    >
                      {sideLabel(trade, isFutures)}
                      {trade.leverage ? ` ${trade.leverage}x` : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {formatQuantity(trade.quantity)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {formatPrice(trade.price, trade.symbol)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {trade.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-gray-100">{children}</p>
    </div>
  );
}
