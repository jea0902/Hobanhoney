import { getOwnerPositions } from "@/lib/bybitPrivate";
import type { OwnerPosition } from "@/lib/bybitPrivate";
import { getWinRateStats } from "@/lib/closedTrades";
import type { TraderGroup } from "@/lib/traderGroups";
import type { PositionRow } from "@/types/position";

// 운영자 본인을 홈 실시간 포지션에 유튜버와 같은 트레이더 한 명으로 보여준다.
// 데이터는 positions 테이블이 아니라 Bybit 실계좌(읽기 전용 API)와 closed_trades에서 온다.
export const FOUNDER_TRADER_NAME = "최무상";
export const FOUNDER_IMAGE =
  "https://tahdftbcqkxqkmclwytu.supabase.co/storage/v1/object/public/trader-images/choimoosang_logo.png";

// 기존 트레이더 카드·표가 쓰는 PositionRow 형태로 바꾼다.
function toPositionRow(position: OwnerPosition): PositionRow {
  return {
    id: "founder",
    type: "actual",
    trader_name: FOUNDER_TRADER_NAME,
    trader_image: FOUNDER_IMAGE,
    symbol: position.symbol,
    leverage: position.leverage,
    quantity: position.quantity,
    entry_price: position.entryPrice,
    liquidation_price: position.liquidationPrice,
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

// 홈 표·이달의 인간지표에서 누르면 갈 곳. 최무상은 운영자 페이지(관리자 전용)로 보낸다.
export function traderHref(traderName: string) {
  return traderName === FOUNDER_TRADER_NAME
    ? "/founder"
    : `/traders/${encodeURIComponent(traderName)}`;
}
