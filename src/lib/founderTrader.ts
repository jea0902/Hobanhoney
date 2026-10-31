import { getOwnerPositions } from "@/lib/bybitPrivate";
import type { OwnerPosition } from "@/lib/bybitPrivate";
import { getClosedPositions, getWinRateStats } from "@/lib/closedTrades";
import type { TraderGroup } from "@/lib/traderGroups";
import type { PositionRow } from "@/types/position";

// 운영자 본인을 홈 실시간 포지션에 유튜버와 같은 트레이더 한 명으로 보여준다.
// 데이터는 positions 테이블이 아니라 Bybit 실계좌(읽기 전용 API)와 closed_trades에서 온다.
export const FOUNDER_TRADER_NAME = "다크페페";
export const FOUNDER_IMAGE =
  "https://tahdftbcqkxqkmclwytu.supabase.co/storage/v1/object/public/trader-images/darkpepe.png";

// 기존 트레이더 카드·표가 쓰는 PositionRow 형태로 바꾼다.
function toPositionRow(position: OwnerPosition): PositionRow {
  return {
    id: `founder-open-${position.symbol}`,
    type: "actual",
    trader_name: FOUNDER_TRADER_NAME,
    trader_image: FOUNDER_IMAGE,
    symbol: position.symbol,
    leverage: position.leverage,
    quantity: position.quantity,
    entry_price: position.entryPrice,
    liquidation_price: position.liquidationPrice,
    // 증거금을 추가하면 레버리지로 다시 계산한 증거금보다 커져서, 운영자 페이지(Bybit 기준)와 수익률이 달라진다.
    margin: position.margin,
    quote: null,
    direction: position.direction,
    result: null,
    result_note: null,
    result_pnl_percent: null,
    result_recorded_at: null,
    created_at: position.openedAt,
  };
}

// 유튜버와 같은 기준으로 규모(포지션 가치)가 가장 큰 1개를 대표 포지션으로 쓴다.
export async function getFounderTrader() {
  const [positions, winRate] = await Promise.all([getOwnerPositions(), getWinRateStats()]);
  const top = positions?.slice().sort((a, b) => b.positionValue - a.positionValue)[0];
  const trader: TraderGroup = {
    traderName: FOUNDER_TRADER_NAME,
    traderImage: FOUNDER_IMAGE,
    rows: [],
    openRow: top ? toPositionRow(top) : null,
    stats: {
      wins: winRate.wins,
      draws: winRate.draws,
      losses: winRate.losses,
      total: winRate.total,
      winRate: winRate.winRate,
    },
  };
  return { trader, markPrice: top?.currentPrice ?? null, positions: positions ?? [] };
}

// 트레이더 기록 페이지(/traders/다크페페)용. 유튜버와 같은 PositionRow 모양으로 맞춘다.
// 열린 포지션은 Bybit 실시간, 종료된 포지션은 closed_trades(Bybit 청산 기록). 청산 기록에는 진입 시각이 없어서
// 종료된 행의 created_at은 종료 시각이다.
export async function getFounderRows(): Promise<PositionRow[]> {
  const [positions, closed] = await Promise.all([getOwnerPositions(), getClosedPositions()]);
  const closedRows: PositionRow[] = closed
    .filter((trade) => trade.direction !== null)
    .map((trade) => ({
      id: `founder-closed-${trade.closedAt}-${trade.symbol}-${trade.entryPrice}`,
      type: "actual",
      trader_name: FOUNDER_TRADER_NAME,
      trader_image: FOUNDER_IMAGE,
      symbol: trade.symbol,
      leverage: trade.leverage,
      quantity: null,
      entry_price: trade.entryPrice,
      liquidation_price: null,
      quote: null,
      direction: trade.direction!,
      result: trade.result,
      result_note: null,
      result_pnl_percent: trade.returnPercent,
      result_recorded_at: trade.closedAt,
      created_at: trade.closedAt,
    }));
  return [...(positions ?? []).map(toPositionRow), ...closedRows];
}

// 홈 표에서 누르면 갈 곳: 운영자도 다른 트레이더와 같은 기록 페이지.
export function traderHref(traderName: string) {
  return `/traders/${encodeURIComponent(traderName)}`;
}
