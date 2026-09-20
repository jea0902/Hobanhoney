import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";
import BalanceChart from "@/components/founder/BalanceChart";
import { getOwnerBalance, getOwnerPositions } from "@/lib/bybitPrivate";
import type { OwnerPosition } from "@/lib/bybitPrivate";
import { getBalanceSnapshots } from "@/lib/balanceSnapshots";
import { getCashFlows } from "@/lib/cashFlows";
import { getWinRateStats } from "@/lib/closedTrades";
import { getUsdtKrwRate } from "@/lib/bithumb";

export const dynamic = "force-dynamic";

function formatUsd(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatKrw(usd: number, rate: number) {
  const sign = usd > 0 ? "+" : "";
  return `${sign}${Math.round(usd * rate).toLocaleString("ko-KR")}원`;
}

export default async function FounderPage() {
  const [balance, positions, snapshots, cashFlows, winRateStats, krwRate] = await Promise.all([
    getOwnerBalance(),
    getOwnerPositions(),
    getBalanceSnapshots(),
    getCashFlows(),
    getWinRateStats(),
    getUsdtKrwRate(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="founder" />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">운영자 포지션</h1>
          <p className="mb-4 text-sm text-gray-400">
            사이트 만든 사람이 직접 실전 트레이딩하는 Bybit 거래소 계정 API를 통해 실시간으로 가져오는
            정보 (26.03.06부터 추적)
          </p>

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="총자산"
              value={
                balance
                  ? `$${balance.totalEquity.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"
              }
              sub={
                balance && krwRate
                  ? `(${Math.round(balance.totalEquity * krwRate).toLocaleString("ko-KR")}원)`
                  : undefined
              }
            />
            <StatCard
              label="미실현손익"
              value={balance ? `${formatUsd(balance.totalUnrealizedPnl)} USDT` : "—"}
              sub={
                balance && krwRate
                  ? `(${formatKrw(balance.totalUnrealizedPnl, krwRate)})`
                  : undefined
              }
              color={
                balance
                  ? balance.totalUnrealizedPnl >= 0
                    ? "text-red-500"
                    : "text-blue-500"
                  : undefined
              }
            />
            <StatCard label="열린 포지션" value={String(positions?.length ?? 0)} />
            <StatCard
              label="누적 승률"
              value={winRateStats.winRate === null ? "—" : `${winRateStats.winRate.toFixed(0)}%`}
              sub={
                winRateStats.total > 0
                  ? `(${winRateStats.wins}승 ${winRateStats.total - winRateStats.wins}패)`
                  : undefined
              }
              color={
                winRateStats.winRate === null
                  ? undefined
                  : winRateStats.winRate >= 50
                    ? "text-red-500"
                    : "text-blue-500"
              }
              footnote={
                winRateStats.long.total > 0 || winRateStats.short.total > 0
                  ? `롱 ${winRateStats.long.winRate === null ? "—" : winRateStats.long.winRate.toFixed(0) + "%"} · 숏 ${winRateStats.short.winRate === null ? "—" : winRateStats.short.winRate.toFixed(0) + "%"}`
                  : undefined
              }
            />
          </div>

          <div className="mb-6 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">잔액 추이</h2>
            <BalanceChart snapshots={snapshots} cashFlows={cashFlows} />
          </div>

          <div className="mb-6 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">실시간 포지션</h2>
            {!positions || positions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
                지금은 열려 있는 포지션이 없어요.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {positions.map((position) => (
                  <PositionCard key={position.symbol} position={position} krwRate={krwRate} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  footnote,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${color ?? "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-base font-bold text-gray-500 dark:text-gray-400">{sub}</p>}
      {footnote && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{footnote}</p>}
    </div>
  );
}

function PositionCard({ position, krwRate }: { position: OwnerPosition; krwRate: number | null }) {
  const directionColor = position.direction === "Long" ? "text-red-500" : "text-blue-500";
  const pnlColor = position.unrealizedPnl >= 0 ? "text-red-500" : "text-blue-500";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <span className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
        {position.symbol}{" "}
        <span className={`font-bold ${directionColor}`}>{position.direction}</span>
      </span>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={`shrink-0 text-lg font-extrabold sm:text-xl ${pnlColor}`}>
          {formatPercent(position.returnOnEquityPercent)}
        </p>
        <p className={`text-right text-base font-semibold ${pnlColor}`}>
          {formatUsd(position.unrealizedPnl)} USDT
          {krwRate && (
            <>
              {" "}
              <span className="whitespace-nowrap">
                ({formatKrw(position.unrealizedPnl, krwRate)})
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-4 sm:text-base">
        <span>진입 {position.entryPrice.toLocaleString("en-US")}</span>
        <span>현재 {position.currentPrice.toLocaleString("en-US")}</span>
        <span>레버리지 {position.leverage}x</span>
        <span>
          청산가{" "}
          {position.liquidationPrice ? position.liquidationPrice.toLocaleString("en-US") : "—"}
        </span>
      </div>
    </div>
  );
}
