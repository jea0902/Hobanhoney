import { getSupabase } from "@/lib/supabase";
import { addRanker, deleteRanker } from "./actions";

export const dynamic = "force-dynamic";

interface RankerRow {
  id: string;
  wallet_address: string;
  note: string | null;
}

export default async function RankersAdminPage() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("rankers")
    .select("*")
    .order("created_at", { ascending: false });

  const rankers = (data ?? []) as RankerRow[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">랭커 관리</h1>
        <p className="mt-1 text-xs text-gray-400">
          지갑 주소만 등록하면 포지션은 하이퍼리퀴드에서 실시간으로 가져와요.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-bold text-gray-900">지갑 주소 추가</h2>
        <form action={addRanker} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">지갑 주소</span>
            <input
              type="text"
              name="wallet_address"
              placeholder="0x..."
              required
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">비고 (선택)</span>
            <input
              type="text"
              name="note"
              placeholder="PNL 3위"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white"
          >
            추가
          </button>
        </form>
      </div>

      {rankers.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
          아직 등록된 랭커가 없어요.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rankers.map((ranker) => (
          <li
            key={ranker.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {ranker.wallet_address}
              </p>
              {ranker.note && <p className="truncate text-xs text-gray-400">{ranker.note}</p>}
            </div>
            <form action={deleteRanker.bind(null, ranker.id)} className="shrink-0">
              <button type="submit" className="text-sm font-medium text-red-500 underline">
                삭제
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
