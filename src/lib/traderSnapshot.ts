import { cache } from "react";
import { getSupabase } from "@/lib/supabase";
import { displaySymbol } from "@/lib/symbol";
import type { PositionRow } from "@/types/position";

// 트레이더 페이지 본문·검색 결과 설명·공유 미리보기 이미지가 같은 "지금 포지션"을 쓴다.
// 한 요청 안에서 메타데이터와 본문이 같은 데이터를 두 번 읽지 않게 cache로 묶는다.
export const getTraderRows = cache(async (name: string): Promise<PositionRow[]> => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("trader_name", name)
    .order("created_at", { ascending: false });
  return (data ?? []) as PositionRow[];
});

// 홈과 같은 기준(가장 큰 열린 포지션)이지만, 시세를 부르지 않도록 진입 금액으로 비교한다.
export function mainOpenPosition(rows: PositionRow[]) {
  return (
    rows
      .filter((row) => !row.result && row.type === "actual" && row.symbol)
      .sort(
        (a, b) =>
          (b.quantity ?? 0) * (b.entry_price ?? 0) - (a.quantity ?? 0) * (a.entry_price ?? 0),
      )[0] ?? null
  );
}

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 2 : 6 });
}

// 예: "BTC 롱 50배 · 진입가 82,734.49 · 강제청산가 81,200"
export function positionSentence(row: PositionRow) {
  const parts = [
    `${displaySymbol(row.symbol!)} ${row.direction === "Long" ? "롱" : "숏"}${row.leverage ? ` ${row.leverage}배` : ""}`,
  ];
  if (row.entry_price) parts.push(`진입가 ${formatPrice(row.entry_price)}`);
  if (row.liquidation_price) parts.push(`강제청산가 ${formatPrice(row.liquidation_price)}`);
  return parts.join(" · ");
}
