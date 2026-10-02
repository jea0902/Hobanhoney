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

// 무승부는 이기지도 지지도 않은 결과라, 분모에 넣으면 승률만 깎이므로 승률 계산에서 뺀다.
export function getWinRate(wins: number, losses: number) {
  return wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
}

export function getResult(returnRatePercent: number): Result {
  if (returnRatePercent >= 3) return "win";
  if (returnRatePercent <= -3) return "loss";
  return "draw";
}
