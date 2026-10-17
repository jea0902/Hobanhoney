import { getHyperliquidPositions } from "@/lib/hyperliquid";
import type { HyperliquidPosition } from "@/lib/hyperliquid";
import type { TraderGroup } from "@/lib/traderGroups";
import type { PositionRow } from "@/types/position";

// 방송 화면이 아니라 하이퍼리퀴드 지갑 주소로 포지션을 실시간 추적하는 트레이더.
// 지갑을 공개 API로 조회만 하므로 DB(positions)에 기록하지 않는다.
export const WALLET_TRADERS = [
  // 대만 가수 출신 코인 트레이더 (2026-10-17 추가)
  { name: "제프리황", address: "0x020ca66c30bec2c4fe3861a94e4db4a498a35872", image: null },
];

// 기존 트레이더 카드·표가 쓰는 PositionRow 형태로 바꾼다.
// 하이퍼리퀴드 포지션 조회엔 진입 시각이 없고, 체결 기록도 최근 2,000건(제프리황은 약 하루 반)만 받을 수 있어
// 진입 시각을 알 수 없다 → created_at을 비워 "경과"를 "—"로 보여준다.
function toPositionRow(
  name: string,
  image: string | null,
  position: HyperliquidPosition,
): PositionRow {
  return {
    id: `wallet-${name}`,
    type: "actual",
    trader_name: name,
    trader_image: image,
    symbol: position.coin,
    leverage: position.leverage,
    quantity: position.quantity,
    entry_price: position.entryPrice,
    liquidation_price: null,
    quote: null,
    direction: position.direction,
    result: null,
    result_note: null,
    result_pnl_percent: null,
    result_recorded_at: null,
    created_at: "",
  };
}

// 유튜버와 같은 기준으로 규모(포지션 가치)가 가장 큰 1개를 대표 포지션으로 쓴다.
// 매매가 워낙 잦아 포지션 단위 승패를 나누기 어려워서 승률은 집계하지 않는다(누적 승률 "—").
export async function getWalletTraders() {
  return Promise.all(
    WALLET_TRADERS.map(async ({ name, address, image }) => {
      const positions = await getHyperliquidPositions(address);
      const top = positions?.slice().sort((a, b) => b.positionValue - a.positionValue)[0];
      const trader: TraderGroup = {
        traderName: name,
        traderImage: image,
        rows: [],
        openRow: top ? toPositionRow(name, image, top) : null,
        stats: { wins: 0, draws: 0, losses: 0, total: 0, winRate: null },
      };
      return { trader, markPrice: top?.currentPrice ?? null };
    }),
  );
}
