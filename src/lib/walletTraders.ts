import { getSupabase } from "@/lib/supabase";
import { getHyperliquidPositions } from "@/lib/hyperliquid";
import { getTraderStats } from "@/lib/traderGroups";
import type { TraderGroup } from "@/lib/traderGroups";
import { WALLET_TRADERS } from "@/lib/walletTraderList";
import type { Direction, PositionRow, Result } from "@/types/position";

export { WALLET_TRADERS };

// 기록 페이지·홈 승률에 쓰는 최근 종료 포지션 수 (사용자 요청 2026-10-17)
const RECENT_TRADES = 100;

interface WalletTradeRow {
  id: string;
  coin: string;
  direction: Direction;
  entry_price: number;
  max_size: number;
  leverage: number;
  result: Result;
  result_pnl_percent: number;
  opened_at: string;
  closed_at: string;
}

export function isWalletTrader(name: string) {
  return WALLET_TRADERS.some((trader) => trader.name === name);
}

// 유튜버 기록(positions 테이블)과 같은 PositionRow 모양으로 돌려줘서 기록 페이지·홈 표를 그대로 쓴다.
// 종료 포지션은 scripts/wallet-traders가 쌓은 wallet_trades, 열린 포지션은 하이퍼리퀴드 실시간 조회.
// 열린 포지션의 진입 시각은 수집 스크립트가 기억해둔 상태(wallet_sync)에서 찾고, 없으면 비워둔다("—").
export async function getWalletTraderRows(name: string): Promise<PositionRow[]> {
  const trader = WALLET_TRADERS.find((t) => t.name === name);
  if (!trader) return [];
  const supabase = getSupabase();
  const [positions, { data: trades }, { data: sync }] = await Promise.all([
    getHyperliquidPositions(trader.address),
    supabase
      .from("wallet_trades")
      .select(
        "id, coin, direction, entry_price, max_size, leverage, result, result_pnl_percent, opened_at, closed_at",
      )
      .eq("trader_name", name)
      .order("closed_at", { ascending: false })
      .limit(RECENT_TRADES),
    supabase.from("wallet_sync").select("open_positions").eq("trader_name", name).maybeSingle(),
  ]);

  const base = {
    type: "actual" as const,
    trader_name: name,
    trader_image: trader.image,
    liquidation_price: null,
    quote: null,
    result_note: null,
  };
  const openStates = (sync?.open_positions ?? {}) as Record<
    string,
    { direction: Direction; openedAt: number }
  >;
  const openRows: PositionRow[] = (positions ?? []).map((position) => {
    const state = openStates[position.coin];
    return {
      ...base,
      id: `wallet-${name}-${position.coin}`,
      symbol: position.coin,
      leverage: position.leverage,
      quantity: position.quantity,
      entry_price: position.entryPrice,
      direction: position.direction,
      result: null,
      result_pnl_percent: null,
      result_recorded_at: null,
      created_at:
        state && state.direction === position.direction
          ? new Date(state.openedAt).toISOString()
          : "",
    };
  });
  const closedRows: PositionRow[] = ((trades ?? []) as WalletTradeRow[]).map((trade) => ({
    ...base,
    id: trade.id,
    symbol: trade.coin,
    leverage: Number(trade.leverage),
    quantity: Number(trade.max_size),
    entry_price: Number(trade.entry_price),
    direction: trade.direction,
    result: trade.result,
    result_pnl_percent: Number(trade.result_pnl_percent),
    result_recorded_at: trade.closed_at,
    created_at: trade.opened_at,
  }));
  return [...openRows, ...closedRows];
}

// 홈 표용. 유튜버와 같은 기준으로 규모(포지션 가치)가 가장 큰 열린 포지션 1개를 대표로 쓴다.
export async function getWalletTraders() {
  return Promise.all(
    WALLET_TRADERS.map(async ({ name, address, image }) => {
      // 같은 주소 조회는 fetch 캐시(10초)로 한 번만 나간다.
      const [rows, positions] = await Promise.all([
        getWalletTraderRows(name),
        getHyperliquidPositions(address),
      ]);
      const top = positions?.slice().sort((a, b) => b.positionValue - a.positionValue)[0];
      const trader: TraderGroup = {
        traderName: name,
        traderImage: image,
        rows,
        openRow: top ? (rows.find((row) => !row.result && row.symbol === top.coin) ?? null) : null,
        stats: getTraderStats(rows, name),
      };
      return { trader, markPrice: top?.currentPrice ?? null };
    }),
  );
}
