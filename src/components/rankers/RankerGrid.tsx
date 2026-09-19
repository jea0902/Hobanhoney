import { getSupabase } from "@/lib/supabase";
import { getUsdtKrwRate } from "@/lib/bithumb";
import { getHyperliquidPositions } from "@/lib/hyperliquid";
import type { HyperliquidPosition } from "@/lib/hyperliquid";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsd(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
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
  "손익(USD)",
  "손익(KRW)",
  "규모",
  "비고",
];

interface RankerRow {
  id: string;
  wallet_address: string;
  note: string | null;
}

export default async function RankerGrid() {
  let rankers: RankerRow[] = [];

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("rankers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    rankers = (data ?? []) as RankerRow[];
  } catch {
    rankers = [];
  }

  if (rankers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
        아직 등록된 랭커가 없어요.
      </div>
    );
  }

  const [rankersWithPositions, usdtKrwRate] = await Promise.all([
    Promise.all(
      rankers.map(async (ranker) => ({
        ranker,
        positions: await getHyperliquidPositions(ranker.wallet_address),
      })),
    ),
    getUsdtKrwRate(),
  ]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {TABLE_HEADERS.map((header, index) => (
              <th
                key={header}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-400 ${
                  index <= 1 ? "text-left" : "text-right"
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankersWithPositions.map(({ ranker, positions }) =>
            renderRankerRows(ranker, positions, usdtKrwRate),
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderRankerRows(
  ranker: RankerRow,
  allPositions: HyperliquidPosition[] | null,
  usdtKrwRate: number | null,
) {
  const name = truncateAddress(ranker.wallet_address);

  if (!allPositions || allPositions.length === 0) {
    return (
      <tr key={ranker.id} className="border-b border-gray-50 last:border-0">
        <td className="whitespace-nowrap px-4 py-3 text-base font-semibold text-gray-900">
          {name}
        </td>
        <td colSpan={8} className="px-4 py-3 text-base text-gray-400">
          포지션 없음
        </td>
        <td className="max-w-[180px] px-4 py-3 text-right text-sm text-gray-400">
          {ranker.note ?? "—"}
        </td>
      </tr>
    );
  }

  // 규모(포지션 가치) 큰 순으로 최대 3개만 보여준다.
  const positions = [...allPositions].sort((a, b) => b.positionValue - a.positionValue).slice(0, 3);

  return positions.map((position, index) => {
    const pnlKrw = usdtKrwRate !== null ? position.unrealizedPnl * usdtKrwRate : null;
    const pnlColor = position.unrealizedPnl >= 0 ? "text-red-500" : "text-blue-500";
    const directionColor = position.direction === "Long" ? "text-red-500" : "text-blue-500";

    return (
      <tr key={`${ranker.id}-${position.coin}`} className="border-b border-gray-50 last:border-0">
        {index === 0 && (
          <td
            rowSpan={positions.length}
            className="whitespace-nowrap px-4 py-3 align-top text-base font-semibold text-gray-900"
          >
            {name}
          </td>
        )}
        <td className="whitespace-nowrap px-4 py-3 text-base text-gray-700">{position.coin}</td>
        <td
          className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${directionColor}`}
        >
          {position.direction}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
          {position.entryPrice.toLocaleString("en-US")}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
          {position.currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${pnlColor}`}>
          {formatPercent(position.returnOnEquityPercent)}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${pnlColor}`}>
          {formatUsd(position.unrealizedPnl)}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-bold ${pnlColor}`}>
          {pnlKrw === null ? "—" : formatKrw(pnlKrw)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-base text-gray-700">
          {position.positionValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} ·{" "}
          {position.leverage}x
        </td>
        {index === 0 && (
          <td
            rowSpan={positions.length}
            className="max-w-[180px] px-4 py-3 text-right align-top text-sm text-gray-400"
          >
            {ranker.note ?? "—"}
          </td>
        )}
      </tr>
    );
  });
}
