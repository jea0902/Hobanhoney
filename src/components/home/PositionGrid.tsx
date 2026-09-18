import { getSupabase } from "@/lib/supabase";
import { getMarkPrice } from "@/lib/bybit";
import { getUsdtKrwRate } from "@/lib/bithumb";
import { getUnrealizedPnl, getReturnRatePercent } from "@/lib/positionMath";
import { getTraderGroups } from "@/lib/traderGroups";
import type { TraderStats, TraderGroup } from "@/lib/traderGroups";
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

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatUsdt(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatKrw(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}`;
}

const TABLE_HEADERS = [
  "트레이더",
  "종목",
  "방향",
  "진입가",
  "현재가",
  "수익률",
  "손익(USDT)",
  "손익(KRW)",
  "규모",
  "누적 승률",
  "경과",
];

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

  const traders = getTraderGroups(positions);

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
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {TABLE_HEADERS.map((header, index) => (
              <th
                key={header}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-400 ${
                  index === 0 ? "text-left" : index === 1 ? "text-left" : "text-right"
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tradersWithMarkPrice.map(({ trader, markPrice }) => (
            <TraderRow
              key={trader.traderName}
              trader={trader}
              markPrice={markPrice}
              usdtKrwRate={usdtKrwRate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TraderCell({ trader }: { trader: TraderGroup }) {
  const avatarInitial = trader.traderName.trim().charAt(0) || "?";

  return (
    <td className="whitespace-nowrap px-4 py-3">
      <div className="flex items-center gap-2">
        {trader.traderImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 외부 URL을 입력하므로 next/image 도메인 화이트리스트 없이 처리
          <img
            src={trader.traderImage}
            alt={trader.traderName}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(trader.traderName)}`}
          >
            {avatarInitial}
          </div>
        )}
        <span className="text-base font-semibold text-gray-900">{trader.traderName}</span>
      </div>
    </td>
  );
}

function WinRateCell({ stats }: { stats: TraderStats }) {
  if (stats.total === 0) {
    return <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-300">—</td>;
  }

  const color = stats.winRate! >= 50 ? "text-red-500" : "text-blue-500";
  return (
    <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${color}`}>
      {stats.winRate!.toFixed(0)}%
    </td>
  );
}

function TraderRow({
  trader,
  markPrice,
  usdtKrwRate,
}: {
  trader: TraderGroup;
  markPrice: number | null;
  usdtKrwRate: number | null;
}) {
  const row = trader.openRow;
  const elapsedCell = row ? (
    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-400">
      {getElapsedMinutes(row.created_at)}분
    </td>
  ) : (
    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-300">—</td>
  );

  if (!row) {
    return (
      <tr className="border-b border-gray-50 last:border-0">
        <TraderCell trader={trader} />
        <td colSpan={8} className="px-4 py-3 text-base text-gray-400">
          포지션 없음
        </td>
        <WinRateCell stats={trader.stats} />
        {elapsedCell}
      </tr>
    );
  }

  if (row.type === "statement") {
    const isLong = row.direction === "Long";
    return (
      <tr className="border-b border-gray-50 last:border-0">
        <TraderCell trader={trader} />
        <td colSpan={8} className="px-4 py-3 text-base text-gray-700">
          <span className="line-clamp-1">“{row.quote}”</span>{" "}
          <span className={`font-semibold ${isLong ? "text-red-500" : "text-blue-500"}`}>
            예상 {isLong ? "상승" : "하락"}
          </span>
        </td>
        <WinRateCell stats={trader.stats} />
        {elapsedCell}
      </tr>
    );
  }

  const isLong = row.direction === "Long";
  const directionColor = isLong ? "text-red-500" : "text-blue-500";

  let returnRate: number | null = null;
  let pnl: number | null = null;
  if (markPrice !== null) {
    pnl = getUnrealizedPnl(row.direction, row.quantity!, row.entry_price!, markPrice);
    returnRate = getReturnRatePercent(pnl, row.quantity!, row.entry_price!, row.leverage!);
  }
  const pnlKrw = pnl !== null && usdtKrwRate !== null ? pnl * usdtKrwRate : null;
  const returnColor =
    returnRate === null ? "text-gray-400" : returnRate >= 0 ? "text-red-500" : "text-blue-500";

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <TraderCell trader={trader} />
      <td className="whitespace-nowrap px-4 py-3 text-base text-gray-700">{row.symbol}</td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${directionColor}`}
      >
        {row.direction}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
        {row.entry_price!.toLocaleString("en-US")}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
        {markPrice === null ? "—" : markPrice.toLocaleString("en-US")}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${returnColor}`}>
        {returnRate === null ? "—" : formatPercent(returnRate)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${returnColor}`}>
        {pnl === null ? "—" : formatUsdt(pnl)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${returnColor}`}>
        {pnlKrw === null ? "—" : formatKrw(pnlKrw)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
        {row.quantity} · {row.leverage}x
      </td>
      <WinRateCell stats={trader.stats} />
      {elapsedCell}
    </tr>
  );
}
