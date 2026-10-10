import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// --dry-run이면 읽기만 하고 아무것도 쓰지 않는다.
export const DRY_RUN = process.argv.includes("--dry-run");

// Supabase는 한 번에 최대 1000행만 돌려줘서 나눠 읽는다. order는 페이지가 겹치지 않게 고유한 순서여야 한다.
export async function readAll<T>(table: string, columns: string, order: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(from, from + 999);
    // 테이블을 만들기 전에도 --dry-run으로 계산을 확인할 수 있게 빈 데이터로 시작한다.
    if (error && DRY_RUN) {
      console.log(`[dry-run] ${table} 읽기 실패, 빈 데이터로 진행: ${error.message}`);
      return rows;
    }
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

export async function insertRows(table: string, rows: object[]) {
  if (DRY_RUN) return;
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 1000));
    if (error) throw error;
  }
}

export async function upsertRows(table: string, rows: object[], onConflict: string) {
  if (DRY_RUN) return;
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 1000), { onConflict });
    if (error) throw error;
  }
}

// 결과는 매번 처음부터 다시 계산하므로 AI별로 지우고 새로 넣는다.
export async function replaceRows(table: string, ai: string, rows: object[]) {
  if (DRY_RUN) return;
  const { error } = await supabase.from(table).delete().eq("ai", ai);
  if (error) throw error;
  await insertRows(table, rows);
}

export async function getTraderPositions(traderName: string, since: string) {
  const { data, error } = await supabase
    .from("positions")
    .select(
      "id, symbol, direction, leverage, entry_price, result, result_note, result_recorded_at, created_at",
    )
    .eq("trader_name", traderName)
    .eq("type", "actual")
    .gte("created_at", since)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function logEvent(level: "error" | "info", message: string, detail?: string) {
  console.log(`[${level}] ${message}${detail ? ` — ${detail}` : ""}`);
  if (DRY_RUN) return;
  await supabase
    .from("logs")
    .insert({ level, source: "ai_investors", message, detail: detail ?? null });
}
