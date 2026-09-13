import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { deletePosition, logout } from "./actions";
import type { PositionRow } from "@/types/position";

export const dynamic = "force-dynamic";

const RESULT_LABEL = { win: "승리", draw: "무승부", loss: "패배" } as const;

function positionSummary(position: PositionRow) {
  return position.type === "actual"
    ? `${position.symbol} · ${position.direction}`
    : `"${position.quote}"`;
}

export default async function AdminPage() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("positions")
    .select("*")
    .order("created_at", { ascending: false });

  const positions = (data ?? []) as PositionRow[];
  const openPositions = positions.filter((position) => !position.result);
  const closedPositions = positions.filter((position) => position.result);

  const closedByTrader = new Map<string, PositionRow[]>();
  for (const position of closedPositions) {
    const rows = closedByTrader.get(position.trader_name) ?? [];
    rows.push(position);
    closedByTrader.set(position.trader_name, rows);
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">포지션 관리</h1>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 underline">
              로그아웃
            </button>
          </form>
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
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
            아직 등록된 포지션이 없어요.
          </p>
        )}

        {openPositions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900">진행 중</h2>
            <ul className="flex flex-col gap-3">
              {openPositions.map((position) => (
                <li
                  key={position.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {position.trader_name} · {positionSummary(position)}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {position.type === "actual"
                        ? `레버리지 ${position.leverage}x · 수량 ${position.quantity}`
                        : `예상 방향: ${position.direction === "Long" ? "상승" : "하락"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link
                      href={`/admin/${position.id}`}
                      className="text-sm font-medium text-gray-600 underline"
                    >
                      수정
                    </Link>
                    <form action={deletePosition.bind(null, position.id)}>
                      <button type="submit" className="text-sm font-medium text-red-500 underline">
                        삭제
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {closedByTrader.size > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-900">지난 기록</h2>
            {[...closedByTrader.entries()].map(([traderName, rows]) => (
              <div key={traderName} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-gray-500">{traderName}</h3>
                <ul className="flex flex-col gap-2">
                  {rows.map((position) => (
                    <li
                      key={position.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {positionSummary(position)} · {RESULT_LABEL[position.result!]}
                        </p>
                        {position.result_note && (
                          <p className="truncate text-xs text-gray-400">{position.result_note}</p>
                        )}
                      </div>
                      <form action={deletePosition.bind(null, position.id)} className="shrink-0">
                        <button
                          type="submit"
                          className="text-sm font-medium text-red-500 underline"
                        >
                          삭제
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
