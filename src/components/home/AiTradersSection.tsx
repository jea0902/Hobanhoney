import Link from "next/link";
import { displayAiSymbol, getAiSummaries, largestHolding } from "@/lib/aiInvestors";
import { assignTiers, TierEmblem } from "@/components/ai/AiTier";
import type { Tier } from "@/components/ai/AiTier";
import AiName from "@/components/ai/AiName";
import Sparkline from "@/components/ai/Sparkline";
import type { AiHolding } from "@/lib/aiInvestors";

type Summary = Awaited<ReturnType<typeof getAiSummaries>>[number];
type CardSize = "featured" | "large" | "small";

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function returnColor(n: number | null) {
  if (n === null) return "text-gray-400";
  return n >= 0 ? "text-red-500" : "text-blue-500";
}

function formatReturn(n: number | null) {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// 대표 종목: 종목, 롱/숏(레버리지), 총자산 대비 비중
function HoldingLabel({ holding, equity }: { holding: AiHolding | null; equity: number }) {
  if (!holding)
    return <span className="text-gray-500 dark:text-gray-400">현재는 현금 보유하고 관망 중</span>;
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

// 크기별 스타일. 맨 위 줄 AI 워뇨띠·AI 호반꿀·AI 포트는 색으로 강조(워뇨띠만 색이 다름). 세 칸이 되며 폭이 좁아져서 글자 크기는 작은 카드와 같게.
const STYLES: Record<
  CardSize,
  { card: string; emblem: "md" | "sm"; name: string; rate: string; chart: string }
> = {
  featured: {
    card: "p-4 sm:p-5 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-900/60 dark:from-amber-950/40 dark:via-gray-900 dark:to-gray-900",
    emblem: "sm",
    name: "text-lg",
    rate: "text-xl",
    chart: "h-10",
  },
  large: {
    card: "p-4 sm:p-5 border-yellow-200 bg-gradient-to-br from-yellow-50/70 via-white to-white dark:border-yellow-900/50 dark:from-yellow-950/20 dark:via-gray-900 dark:to-gray-900",
    emblem: "sm",
    name: "text-lg",
    rate: "text-xl",
    chart: "h-10",
  },
  small: {
    card: "p-4 border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900",
    emblem: "sm",
    name: "text-lg",
    rate: "text-xl",
    chart: "h-10",
  },
};

function AiCard({ summary, size, tier }: { summary: Summary; size: CardSize; tier: Tier }) {
  const style = STYLES[size];
  const { meta, latest, annualReturn, holdings, returnSeries } = summary;
  const equity = latest?.equity ?? 0;

  return (
    <Link
      href={`/ai/${meta.id}`}
      className={`group flex h-full flex-col rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TierEmblem tier={tier} size={style.emblem} />
          <div className="min-w-0">
            <AiName name={meta.name} className={`${style.name} group-hover:underline`} />
            <p
              className={`mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm ${size === "small" ? "line-clamp-1" : "line-clamp-2"}`}
            >
              {meta.summary}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-gray-400">올해 수익률</p>
          <p className={`font-extrabold leading-tight ${style.rate} ${returnColor(annualReturn)}`}>
            {formatReturn(annualReturn)}
          </p>
        </div>
      </div>

      <Sparkline values={returnSeries} className={`mt-3 w-full ${style.chart}`} />

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <HoldingLabel holding={largestHolding(holdings)} equity={equity} />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {!latest
            ? "계산 전"
            : size === "small"
              ? formatUsd(latest.equity)
              : [
                  `총자산 ${formatUsd(latest.equity)}`,
                  `입금 ${formatUsd(latest.invested)}`,
                  latest.withdrawn > 0 ? `출금 ${formatUsd(latest.withdrawn)}` : null,
                  `${holdings.length}종목`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
        </span>
      </div>
    </Link>
  );
}

export default async function AiTradersSection() {
  let summaries: Summary[] = [];
  try {
    summaries = await getAiSummaries();
  } catch {
    summaries = [];
  }
  // AI_TRADERS 순서대로: 첫 번째(워뇨띠)는 가장 눈에 띄게, 두·세 번째(호반꿀·포트)는 살짝 크게, 나머지는 작은 카드
  const [featured, second, third, ...rest] = summaries;
  // 올해 수익률 순위로 티어 (챌린저 ~ 브론즈)
  const tiers = assignTiers(
    summaries.map((s) => ({ id: s.meta.id, annualReturn: s.annualReturn })),
  );

  return (
    <section className="px-6 py-6">
      <div className="mx-auto max-w-6xl xl:max-w-none">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
          AI 트레이더
          <span className="text-xs font-medium text-gray-400 sm:text-sm">
            (매일 오전 7시 30분 갱신)
          </span>
        </h2>
        <p className="-mt-2 mb-4 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
          정해진 전략대로만 매매하는 가상 투자자 (2026-03-06부터 매월 100만원 적립 가정)
        </p>

        <div className="flex flex-col gap-3">
          {/* 워뇨띠·호반꿀·포트는 넓은 화면에서 한 줄에 셋 (아래 카드들과 같은 칸 폭, 중간 화면은 둘 + 하나) */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {featured && (
              <AiCard summary={featured} size="featured" tier={tiers.get(featured.meta.id)!} />
            )}
            {second && <AiCard summary={second} size="large" tier={tiers.get(second.meta.id)!} />}
            {third && (
              <div className="sm:col-span-2 xl:col-span-1">
                <AiCard summary={third} size="large" tier={tiers.get(third.meta.id)!} />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((summary) => (
              <AiCard
                key={summary.meta.id}
                summary={summary}
                size="small"
                tier={tiers.get(summary.meta.id)!}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
