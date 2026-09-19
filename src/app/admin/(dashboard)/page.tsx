import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { deletePosition } from "../actions";
import type { PositionRow } from "@/types/position";

export const dynamic = "force-dynamic";

const RESULT_LABEL = { win: "승리", draw: "무승부", loss: "패배" } as const;

function positionSummary(position: PositionRow) {
  return position.type === "actual"
    ? `${position.symbol} · ${position.direction}`
    : `"${position.quote}"`;
}

function positionDetail(position: PositionRow) {
  return position.type === "actual"
    ? `레버리지 ${position.leverage}x · 수량 ${position.quantity}`
    : `예상 방향: ${position.direction === "Long" ? "상승" : "하락"}`;
}

export default async function AdminPage() {
  const supabase = getSupabase();

  const [positionsRes, rankersRes, errorLogsRes] = await Promise.all([
    supabase.from("positions").select("*").order("created_at", { ascending: false }),
    supabase.from("rankers").select("id", { count: "exact", head: true }),
    supabase.from("logs").select("id", { count: "exact", head: true }).eq("level", "error"),
  ]);

  const positions = (positionsRes.data ?? []) as PositionRow[];
  const openPositions = positions.filter((position) => !position.result);
  const closedPositions = positions.filter((position) => position.result);
  const wins = closedPositions.filter((position) => position.result === "win").length;
  const winRate =
    closedPositions.length > 0 ? Math.round((wins / closedPositions.length) * 100) : null;

  const closedByTrader = new Map<string, PositionRow[]>();
  for (const position of closedPositions) {
    const rows = closedByTrader.get(position.trader_name) ?? [];
    rows.push(position);
    closedByTrader.set(position.trader_name, rows);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">유튜버 포지션 관리</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="진행 중 포지션" value={String(openPositions.length)} />
        <StatCard label="전체 누적 승률" value={winRate === null ? "—" : `${winRate}%`} />
        <StatCard label="등록된 랭커" value={String(rankersRes.count ?? 0)} />
        <StatCard label="에러 로그" value={String(errorLogsRes.count ?? 0)} />
      </div>

      <div className="flex gap-2">
        <Link
          href="/admin/new?type=actual"
          className="flex-1 rounded-lg bg-[#3182F6] px-4 py-2 text-center text-sm font-semibold text-white"
        >
          + 실제 포지션 추가
        </Link>
        <Link
          href="/admin/new?type=statement"
          className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          + 예측 발언 추가
        </Link>
      </div>

      {positions.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
          아직 등록된 포지션이 없어요.
        </p>
      )}

      {openPositions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">진행 중</h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[320px] border-collapse sm:min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-4 py-3">트레이더</th>
                  <th className="px-4 py-3">내용</th>
                  <th className="hidden px-4 py-3 sm:table-cell">세부</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((position) => (
                  <tr
                    key={position.id}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {position.trader_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {positionSummary(position)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                      {positionDetail(position)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <Link
                        href={`/admin/${position.id}`}
                        className="mr-3 font-medium text-gray-600 underline dark:text-gray-300"
                      >
                        수정
                      </Link>
                      <form action={deletePosition.bind(null, position.id)} className="inline">
                        <button type="submit" className="font-medium text-red-500 underline">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {closedByTrader.size > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">지난 기록</h2>
          {[...closedByTrader.entries()].map(([traderName, rows]) => (
            <div key={traderName} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {traderName}
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <table className="w-full min-w-[300px] border-collapse sm:min-w-[480px]">
                  <tbody>
                    {rows.map((position) => (
                      <tr
                        key={position.id}
                        className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {positionSummary(position)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {RESULT_LABEL[position.result!]}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-gray-400 dark:text-gray-500 sm:table-cell">
                          {position.result_note ?? ""}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                          <form action={deletePosition.bind(null, position.id)}>
                            <button type="submit" className="font-medium text-red-500 underline">
                              삭제
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-extrabold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
