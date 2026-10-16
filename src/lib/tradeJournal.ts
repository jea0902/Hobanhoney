import { getSupabase } from "@/lib/supabase";
import { getOwnerPositions } from "@/lib/bybitPrivate";
import { logEvent } from "@/lib/logger";
import type { Direction } from "@/types/position";

export interface JournalEntry {
  id: string;
  symbol: string;
  direction: Direction;
  position_value: number;
  opened_at: string;
  closed_at: string | null;
  entry_reason: string | null;
  exit_reason: string | null;
}

// Bybit 열린 포지션과 매매일지를 맞춘다. 관리자 매매일지 페이지를 열 때와 6시간 자동 수집 때 부른다.
// 새 포지션 → 항목 생성, 이미 있는 포지션 → 비중 갱신, 사라진 포지션 → 종료 표시.
export async function syncTradeJournal() {
  const positions = await getOwnerPositions();
  // 조회에 실패했을 때 진행 중 항목을 전부 종료로 잘못 표시하지 않게 아무것도 하지 않는다.
  if (!positions) return;

  const supabase = getSupabase();
  const { data } = await supabase
    .from("trade_journal")
    .select("id, symbol, direction")
    .is("closed_at", null);
  const openEntries = (data ?? []) as Pick<JournalEntry, "id" | "symbol" | "direction">[];

  for (const position of positions) {
    const entry = openEntries.find(
      (e) => e.symbol === position.symbol && e.direction === position.direction,
    );
    if (entry) {
      await supabase
        .from("trade_journal")
        .update({ position_value: position.positionValue })
        .eq("id", entry.id);
    } else {
      const { error } = await supabase.from("trade_journal").insert({
        symbol: position.symbol,
        direction: position.direction,
        position_value: position.positionValue,
        opened_at: position.openedAt,
      });
      if (error) logEvent("error", "trade_journal", "매매일지 항목 생성 실패", error.message);
    }
  }

  const closedIds = openEntries
    .filter((e) => !positions.some((p) => p.symbol === e.symbol && p.direction === e.direction))
    .map((e) => e.id);
  if (closedIds.length > 0) {
    await supabase
      .from("trade_journal")
      .update({ closed_at: new Date().toISOString() })
      .in("id", closedIds);
  }
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const { data } = await getSupabase()
    .from("trade_journal")
    .select(
      "id, symbol, direction, position_value, opened_at, closed_at, entry_reason, exit_reason",
    )
    .order("opened_at", { ascending: false });
  return ((data ?? []) as JournalEntry[]).map((row) => ({
    ...row,
    position_value: Number(row.position_value),
  }));
}
