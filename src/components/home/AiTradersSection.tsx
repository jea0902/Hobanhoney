import Link from "next/link";
import { AI_COMMON_NOTE, displayAiSymbol, getAiSummaries, largestHolding } from "@/lib/aiInvestors";
import type { AiHolding } from "@/lib/aiInvestors";
import HorizontalScrollArrows from "@/components/HorizontalScrollArrows";

type Summary = Awaited<ReturnType<typeof getAiSummaries>>[number];

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function returnPercentOf(summary: Summary) {
  const latest = summary.latest;
  if (!latest || latest.invested <= 0) return null;
  return (latest.equity / latest.invested - 1) * 100;
}

function returnColor(n: number | null) {
  if (n === null) return "text-gray-400";
  return n >= 0 ? "text-red-500" : "text-blue-500";
}

function formatReturn(n: number | null) {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// 대표 종목 칸: 종목, 롱/숏(레버리지), 총자산 대비 비중
function HoldingLabel({ holding, equity }: { holding: AiHolding | null; equity: number }) {
  if (!holding) return <span className="text-gray-400 dark:text-gray-500">현금만 보유</span>;
  const isShort = holding.quantity < 0;
  return (
    <span>
      <span className="font-semibold text-gray-900 dark:text-gray-100">
        {displayAiSymbol(holding.symbol)}
      </span>{" "}
      <span className={`font-bold ${isShort ? "text-blue-500" : "text-red-500"}`}>
        {isShort ? "숏" : "롱"}
        {holding.leverage ? ` ${holding.leverage}x` : ""}
      </span>{" "}
      {equity > 0 && (
        <span className="text-gray-400">
          {((Math.abs(holding.value) / equity) * 100).toFixed(0)}%
        </span>
      )}
    </span>
  );
}

function AiAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
      AI
    </div>
  );
}

export default async function AiTradersSection() {
  let summaries: Summary[] = [];
  try {
    summaries = await getAiSummaries();
  } catch {
    summaries = [];
  }

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-gray-100 sm:text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
          AI 트레이더
          <span className="text-gray-400">(매일 오전 7시 30분 갱신)</span>
        </h2>
        <p className="-mt-2 mb-4 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
          각자 정해진 전략대로만 움직이는 가상 투자자. {AI_COMMON_NOTE} 이름 누르면 전략과 전체 보유
          종목, 월별 성과 볼 수 있어.
        </p>

        {/* 모바일: 카드형 */}
        <div className="flex flex-col gap-3 sm:hidden">
          {summaries.map((summary) => {
            const rate = returnPercentOf(summary);
            const equity = summary.latest?.equity ?? 0;
            return (
              <Link
                key={summary.meta.id}
                href={`/ai/${summary.meta.id}`}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AiAvatar />
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {summary.meta.name}
                      </p>
                      <p className="text-xs text-gray-400">{summary.meta.summary}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 text-xl font-extrabold ${returnColor(rate)}`}>
                    {formatReturn(rate)}
                  </p>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
                  <HoldingLabel holding={largestHolding(summary.holdings)} equity={equity} />
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {summary.latest
                      ? `${formatUsd(summary.latest.equity)} / 입금 ${formatUsd(summary.latest.invested)}`
                      : "계산 전"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 데스크탑: 테이블형 */}
        <div className="hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:block">
          <HorizontalScrollArrows>
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["AI", "대표 종목", "보유", "총자산", "누적 입금", "수익률"].map((header, i) => (
                    <th
                      key={header}
                      className={`whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 ${
                        i < 2 ? "text-left" : "text-right"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const rate = returnPercentOf(summary);
                  const equity = summary.latest?.equity ?? 0;
                  return (
                    <tr
                      key={summary.meta.id}
                      className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={`/ai/${summary.meta.id}`} className="flex items-center gap-2">
                          <AiAvatar />
                          <div>
                            <p className="text-base font-semibold text-gray-900 underline-offset-4 hover:underline dark:text-gray-100">
                              {summary.meta.name}
                            </p>
                            <p className="text-xs text-gray-400">{summary.meta.summary}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-base">
                        <HoldingLabel holding={largestHolding(summary.holdings)} equity={equity} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700 dark:text-gray-300">
                        {summary.holdings.length}종목
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700 dark:text-gray-300">
                        {summary.latest ? formatUsd(summary.latest.equity) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-500 dark:text-gray-400">
                        {summary.latest ? formatUsd(summary.latest.invested) : "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${returnColor(rate)}`}
                      >
                        {formatReturn(rate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </HorizontalScrollArrows>
        </div>
      </div>
    </section>
  );
}
