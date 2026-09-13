import type { Direction, Result } from "@/types/position";

export function getUnrealizedPnl(
  direction: Direction,
  quantity: number,
  entryPrice: number,
  markPrice: number,
) {
  const priceDiff = direction === "Long" ? markPrice - entryPrice : entryPrice - markPrice;
  return quantity * priceDiff;
}

export function getReturnRatePercent(
  pnl: number,
  quantity: number,
  entryPrice: number,
  leverage: number,
) {
  const margin = (quantity * entryPrice) / leverage;
  if (margin === 0) return 0;
  return (pnl / margin) * 100;
}

export function getResult(returnRatePercent: number): Result {
  if (returnRatePercent >= 3) return "win";
  if (returnRatePercent <= -3) return "loss";
  return "draw";
}
