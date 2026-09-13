import { getSupabase } from "@/lib/supabase";
import { getMarkPrice } from "@/lib/bybit";
import { getUsdtKrwRate } from "@/lib/bithumb";
import { getUnrealizedPnl, getReturnRatePercent } from "@/lib/positionMath";
import type { PositionRow } from "@/types/position";

const AVATAR_COLORS = ["bg-gray-400", "bg-gray-500", "bg-gray-600", "bg-gray-700", "bg-gray-800"];

function getAvatarColor(name: string) {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getElapsedMinutes(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function formatUsdt(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatKrw(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("ko-KR")} KRW`;
}

interface TraderStats {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number | null;
}

function getTraderStats(rows: PositionRow[], traderName: string): TraderStats {
  const decided = rows.filter((row) => row.trader_name === traderName && row.result);
  const wins = decided.filter((row) => row.result === "win").length;
  const draws = decided.filter((row) => row.result === "draw").length;
  const losses = decided.filter((row) => row.result === "loss").length;
  const total = decided.length;
  return { wins, draws, losses, total, winRate: total > 0 ? (wins / total) * 100 : null };
}

interface TraderGroup {
  traderName: string;
  traderImage: string | null;
  openRow: PositionRow | null;
  stats: TraderStats;
}

export default async function PositionGrid() {
  let positions: PositionRow[] = [];

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    positions = (data ?? []) as PositionRow[];
  } catch {
    positions = [];
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
        아직 등록된 포지션이 없어요.
      </div>
    );
  }

  // 트레이더별로 묶는다. positions는 최신순 정렬이라 첫 등장 순서 = 최근 활동순.
  const traderNames = [...new Set(positions.map((row) => row.trader_name))];
  const traders: TraderGroup[] = traderNames.map((traderName) => {
    const rows = positions.filter((row) => row.trader_name === traderName);
    return {
      traderName,
      traderImage: rows[0]?.trader_image ?? null,
      openRow: rows.find((row) => !row.result) ?? null,
      stats: getTraderStats(positions, traderName),
    };
  });

  const [tradersWithMarkPrice, usdtKrwRate] = await Promise.all([
    Promise.all(
      traders.map(async (trader) => {
        const isOpenActual = trader.openRow?.type === "actual";
        const markPrice = isOpenActual ? await getMarkPrice(trader.openRow!.symbol!) : null;
        return { trader, markPrice };
      }),
    ),
    getUsdtKrwRate(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tradersWithMarkPrice.map(({ trader, markPrice }) => {
        if (!trader.openRow) {
          return <EmptyTraderCard key={trader.traderName} trader={trader} />;
        }
        if (trader.openRow.type === "statement") {
          return (
            <StatementCard key={trader.traderName} position={trader.openRow} stats={trader.stats} />
          );
        }
        return (
          <PositionCard
            key={trader.traderName}
            position={trader.openRow}
            markPrice={markPrice}
            usdtKrwRate={usdtKrwRate}
            stats={trader.stats}
          />
        );
      })}
    </div>
  );
}

function TraderPhoto({
  traderName,
  traderImage,
}: {
  traderName: string;
  traderImage: string | null;
}) {
  const avatarInitial = traderName.trim().charAt(0) || "?";

  if (traderImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 외부 URL을 입력하므로 next/image 도메인 화이트리스트 없이 처리
      <img
        src={traderImage}
        alt={traderName}
        className="h-28 w-28 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div
      className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-xl text-4xl font-bold text-white ${getAvatarColor(traderName)}`}
    >
      {avatarInitial}
    </div>
  );
}

function WinRateLine({ stats }: { stats: TraderStats }) {
  if (stats.total === 0) return null;

  const winRateColor = stats.winRate! >= 50 ? "text-red-500" : "text-blue-500";

  return (
    <p className="text-xs text-gray-400">
      누적 승률{" "}
      <span className={`text-sm font-bold ${winRateColor}`}>{stats.winRate!.toFixed(0)}%</span> (
      {stats.wins}승 {stats.draws}무 {stats.losses}패)
    </p>
  );
}

function EmptyTraderCard({ trader }: { trader: TraderGroup }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4">
      <TraderPhoto traderName={trader.traderName} traderImage={trader.traderImage} />

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="truncate text-sm font-semibold text-gray-900">{trader.traderName}</p>
          <p className="mt-1 text-sm text-gray-400">포지션 없음</p>
        </div>
        <WinRateLine stats={trader.stats} />
      </div>
    </div>
  );
}

function PositionCard({
  position,
  markPrice,
  usdtKrwRate,
  stats,
}: {
  position: PositionRow;
  markPrice: number | null;
  usdtKrwRate: number | null;
  stats: TraderStats;
}) {
  const isLong = position.direction === "Long";
  const directionColor = isLong ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500";

  let pnl: number | null = null;
  let returnRate: number | null = null;
  if (markPrice !== null) {
    pnl = getUnrealizedPnl(
      position.direction,
      position.quantity!,
      position.entry_price!,
      markPrice,
    );
    returnRate = getReturnRatePercent(
      pnl,
      position.quantity!,
      position.entry_price!,
      position.leverage!,
    );
  }
  const pnlKrw = pnl !== null && usdtKrwRate !== null ? pnl * usdtKrwRate : null;
  const pnlColor =
    returnRate === null ? "text-gray-400" : returnRate >= 0 ? "text-red-500" : "text-blue-500";

  return (
    <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4">
      <TraderPhoto traderName={position.trader_name} traderImage={position.trader_image} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {position.trader_name}
          </span>
          <span className="ml-auto shrink-0 text-xs text-gray-400">
            {getElapsedMinutes(position.created_at)}분
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-600">
            {position.symbol}
          </span>
          <span className={`rounded-md px-2.5 py-1 text-sm font-bold ${directionColor}`}>
            {position.direction} {position.leverage}x
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Stat label="수량" value={position.quantity!.toLocaleString("en-US")} />
          <Stat label="진입가" value={position.entry_price!.toLocaleString("en-US")} />
          <Stat
            label="현재가"
            value={markPrice === null ? "—" : markPrice.toLocaleString("en-US")}
          />
          <Stat label="청산가" value={position.liquidation_price!.toLocaleString("en-US")} />
        </div>

        <WinRateLine stats={stats} />

        <div className="mt-auto flex items-center justify-between">
          <span className="text-lg font-bold text-gray-700">미실현 손익</span>
          <div className="text-right">
            <p className={`text-xl font-extrabold leading-tight ${pnlColor}`}>
              {pnl === null ? "—" : `${formatUsdt(pnl)} USDT`}
            </p>
            <p className={`text-xl font-extrabold leading-tight ${pnlColor}`}>
              {returnRate === null ? "—" : `(${formatPercent(returnRate)})`}
            </p>
            {pnlKrw !== null && (
              <p className={`text-xl font-extrabold leading-tight ${pnlColor}`}>
                ≈{formatKrw(pnlKrw)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatementCard({ position, stats }: { position: PositionRow; stats: TraderStats }) {
  const isLong = position.direction === "Long";
  const directionColor = isLong ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500";

  return (
    <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4">
      <TraderPhoto traderName={position.trader_name} traderImage={position.trader_image} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {position.trader_name}
          </span>
          <span className="ml-auto shrink-0 text-xs text-gray-400">
            {getElapsedMinutes(position.created_at)}분
          </span>
        </div>

        <blockquote className="text-sm text-gray-700">“{position.quote}”</blockquote>

        <span className={`w-fit rounded-md px-2.5 py-1 text-sm font-bold ${directionColor}`}>
          예상: {isLong ? "상승" : "하락"}
        </span>

        <WinRateLine stats={stats} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-gray-500">
      {label} <span className="font-semibold text-gray-800">{value}</span>
    </span>
  );
}
