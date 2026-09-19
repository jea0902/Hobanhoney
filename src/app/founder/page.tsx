import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import AutoRefresh from "@/components/AutoRefresh";
import BalanceChart from "@/components/founder/BalanceChart";
import { getOwnerBalance, getOwnerPositions } from "@/lib/bybitPrivate";
import type { OwnerPosition } from "@/lib/bybitPrivate";
import { getBalanceSnapshots } from "@/lib/balanceSnapshots";

export const dynamic = "force-dynamic";

function formatUsd(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default async function FounderPage() {
  const [balance, positions, snapshots] = await Promise.all([
    getOwnerBalance(),
    getOwnerPositions(),
    getBalanceSnapshots(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50">
      <AutoRefresh intervalMs={10000} />
      <Navbar active="founder" />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-1 text-lg font-bold text-gray-900">주인장 포지션</h1>
          <p className="mb-4 text-sm text-gray-400">
            사이트 만든 사람이 직접 실전 트레이딩하는 계좌예요.
          </p>

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label="총자산"
              value={
                balance
                  ? `$${balance.totalEquity.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"
              }
            />
            <StatCard
              label="미실현손익"
              value={balance ? `${formatUsd(balance.totalUnrealizedPnl)} USDT` : "—"}
              color={
                balance
                  ? balance.totalUnrealizedPnl >= 0
                    ? "text-red-500"
                    : "text-blue-500"
                  : undefined
              }
            />
            <StatCard label="열린 포지션" value={String(positions?.length ?? 0)} />
          </div>

          <div className="mb-6 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900">잔액 추이</h2>
            <BalanceChart snapshots={snapshots} />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900">실시간 포지션</h2>
            {!positions || positions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
                지금은 열려 있는 포지션이 없어요.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {positions.map((position) => (
                  <PositionCard key={position.symbol} position={position} />
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${color ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function PositionCard({ position }: { position: OwnerPosition }) {
  const directionColor = position.direction === "Long" ? "text-red-500" : "text-blue-500";
  const pnlColor = position.unrealizedPnl >= 0 ? "text-red-500" : "text-blue-500";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-gray-900">
          {position.symbol}{" "}
          <span className={`font-bold ${directionColor}`}>{position.direction}</span>
        </span>
        <span className={`text-lg font-extrabold ${pnlColor}`}>
          {formatPercent(position.returnOnEquityPercent)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 sm:grid-cols-4">
        <span>진입 {position.entryPrice.toLocaleString("en-US")}</span>
        <span>현재 {position.currentPrice.toLocaleString("en-US")}</span>
        <span>레버리지 {position.leverage}x</span>
        <span>
          청산가{" "}
          {position.liquidationPrice ? position.liquidationPrice.toLocaleString("en-US") : "—"}
        </span>
      </div>
      <p className={`mt-2 text-sm font-semibold ${pnlColor}`}>
        {formatUsd(position.unrealizedPnl)} USDT
      </p>
    </div>
  );
}
