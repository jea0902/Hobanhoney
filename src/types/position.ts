export type Direction = "Long" | "Short";
export type PositionType = "actual" | "statement";
export type Result = "win" | "draw" | "loss";

export interface PositionRow {
  id: string;
  type: PositionType;
  trader_name: string;
  trader_image: string | null;

  // 실제 포지션 전용 (type === "actual")
  symbol: string | null;
  leverage: number | null;
  quantity: number | null;
  entry_price: number | null;
  liquidation_price: number | null;

  // 예측 발언 전용 (type === "statement")
  quote: string | null;

  // 공통: 실제 포지션의 포지션 방향 / 예측 발언의 예상 방향
  direction: Direction;

  // 결과 (둘 다 사용, 수정 폼 안에서 같이 저장됨)
  result: Result | null;
  result_note: string | null;
  result_pnl_percent: number | null;
  result_recorded_at: string | null;

  created_at: string;
}
