import { createClient } from "@supabase/supabase-js";
import type { PositionRow } from "../../src/types/position.ts";
import { getResult, getReturnRatePercent, getUnrealizedPnl } from "../../src/lib/positionMath.ts";
import type { ScreenPosition } from "./gemma.ts";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// 기존 DB는 "BTC/USDT" 형식으로 저장돼 있다.
function toDbSymbol(symbol: string) {
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4)}/USDT` : symbol;
}

export async function getOpenRows(traderName: string): Promise<PositionRow[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .eq("trader_name", traderName)
    .eq("type", "actual")
    .is("result", null);
  if (error) throw error;
  return data as PositionRow[];
}

async function getTraderImage(traderName: string): Promise<string | null> {
  const { data } = await supabase
    .from("positions")
    .select("trader_image")
    .eq("trader_name", traderName)
    .not("trader_image", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.trader_image ?? null;
}

export async function openPosition(traderName: string, position: ScreenPosition) {
  const { error } = await supabase.from("positions").insert({
    type: "actual",
    trader_name: traderName,
    trader_image: await getTraderImage(traderName),
    symbol: toDbSymbol(position.symbol),
    direction: position.direction,
    leverage: position.leverage,
    quantity: position.size,
    entry_price: position.entryPrice,
    liquidation_price: position.liqPrice,
  });
  if (error) throw error;
}

export async function updatePosition(row: PositionRow, position: ScreenPosition) {
  const { error } = await supabase
    .from("positions")
    .update({
      quantity: position.size,
      entry_price: position.entryPrice,
      // 가려져서 못 읽은 값은 기존 값을 유지한다.
      leverage: position.leverage ?? row.leverage,
      liquidation_price: position.liqPrice ?? row.liquidation_price,
    })
    .eq("id", row.id);
  if (error) throw error;
}

export async function closePosition(row: PositionRow, exitPrice: number, note: string) {
  const quantity = row.quantity ?? 0;
  const entryPrice = row.entry_price ?? 0;
  const pnl = getUnrealizedPnl(row.direction, quantity, entryPrice, exitPrice);
  const returnRate = getReturnRatePercent(pnl, quantity, entryPrice, row.leverage ?? 1);

  // 사라지기 직전 가격이 강제청산가 근처였으면 강제청산으로 본다.
  const liquidated =
    row.liquidation_price !== null &&
    Math.abs(exitPrice - row.liquidation_price) <= row.liquidation_price * 0.01;

  const { error } = await supabase
    .from("positions")
    .update({
      result: getResult(returnRate),
      result_pnl_percent: returnRate,
      result_note: `[자동] ${liquidated ? "강제청산 추정" : "종료"} — ${note}, 종료가격 ${exitPrice}`,
      result_recorded_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;
}

// 어떤 화면을 근거로 무엇을 바꿨는지 남겨서, 잘못 반영됐을 때 추적할 수 있게 한다.
export async function logAgent(level: "error" | "info", message: string, detail?: unknown) {
  await supabase.from("logs").insert({
    level,
    source: "position_agent",
    message,
    detail: detail === undefined ? null : JSON.stringify(detail),
  });
}
