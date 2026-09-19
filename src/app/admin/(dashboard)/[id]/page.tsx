import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import PositionForm from "../PositionForm";
import StatementForm from "../StatementForm";
import { updatePosition, updateStatement, closePosition } from "../../actions";
import type { PositionRow } from "@/types/position";

export const dynamic = "force-dynamic";

const RESULT_LABEL = { win: "승리", draw: "무승부", loss: "패배" } as const;

export default async function EditPositionPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { data } = await supabase.from("positions").select("*").eq("id", params.id).maybeSingle();

  const position = data as PositionRow | null;
  if (!position) notFound();

  // 이미 결과가 기록된(청산된) 포지션은 기록 보존을 위해 수정할 수 없다.
  // 트레이더가 새 포지션을 잡으면 이 row를 고치지 말고 "+ 추가"로 새로 만들어야 한다.
  if (position.result) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">지난 기록</h1>
        <p className="mb-4 text-sm text-gray-400">
          이미 결과가 기록된 포지션은 기록을 보존하기 위해 수정할 수 없어요. 트레이더가 새 포지션을
          잡았다면 &lsquo;+ 추가&rsquo;로 새 항목을 만들어주세요.
        </p>
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <p>트레이더: {position.trader_name}</p>
          <p>
            {position.type === "actual"
              ? `${position.symbol} · ${position.direction} · ${position.leverage}x`
              : `"${position.quote}"`}
          </p>
          <p>결과: {RESULT_LABEL[position.result]}</p>
          {position.result_note && <p>메모: {position.result_note}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {position.type === "actual" ? "포지션 수정" : "발언 수정"}
        </h1>
        <p className="mb-4 text-sm text-gray-400">트레이더: {position.trader_name}</p>

        {position.type === "actual" ? (
          <PositionForm
            action={updatePosition.bind(null, position.id)}
            defaultValues={{
              trader_image: position.trader_image ?? "",
              symbol: position.symbol ?? "",
              direction: position.direction,
              leverage: String(position.leverage ?? ""),
              quantity: String(position.quantity ?? ""),
              entry_price: String(position.entry_price ?? ""),
              liquidation_price: String(position.liquidation_price ?? ""),
              result: position.result ?? "",
              result_note: position.result_note ?? "",
            }}
            submitLabel="저장"
          />
        ) : (
          <StatementForm
            action={updateStatement.bind(null, position.id)}
            defaultValues={{
              trader_image: position.trader_image ?? "",
              quote: position.quote ?? "",
              direction: position.direction,
              result: position.result ?? "",
              result_note: position.result_note ?? "",
            }}
            submitLabel="저장"
          />
        )}
      </div>

      {position.type === "actual" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            빠른 결과 계산
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            지금 시세 기준 수익률로 승/무/패를 자동 계산해서 위 결과 필드에 저장합니다. (+3% 이상
            승리, -3% 이하 패배, 그 사이 무승부) 저장 후에도 위 폼에서 언제든 손으로 바꿀 수 있어요.
          </p>
          <form action={closePosition.bind(null, position.id)}>
            <button
              type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              지금 계산해서 저장
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
