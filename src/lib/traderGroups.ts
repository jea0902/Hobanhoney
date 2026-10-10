import type { PositionRow } from "@/types/position";
import { getWinRate } from "@/lib/positionMath";
import { getMarkPrice } from "@/lib/bybit";

export interface TraderStats {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number | null;
}

export interface TraderGroup {
  traderName: string;
  traderImage: string | null;
  rows: PositionRow[];
  openRow: PositionRow | null;
  stats: TraderStats;
}

// 자동 추적이 안 되는 트레이더는 사이트 어디에도 보이지 않게 숨긴다 (2026-10-11 사용자 결정, DB 기록은 보존).
// 사또·자두두: 방송마다 직접 만든 썸네일이라 라이브 화면을 볼 수 없음. 용느: 추가 후 기록이 한 건도 없음.
// 다시 보이게 하려면 여기서 이름을 빼면 된다.
export const HIDDEN_TRADERS = ["사또", "자두두", "용느"];

// 포지션 에이전트는 보이는 포지션을 전부 기록하므로, 트레이더마다 규모(수량 × 현재가)가 가장 큰
// 열린 포지션 1개를 대표로 고른다. 홈 포지션 표·인간지표 컨센서스·역발상 신호등이 같은 기준을 쓴다.
export async function withRepresentativePosition(traders: TraderGroup[]) {
  return Promise.all(
    traders.map(async (trader) => {
      const openActualRows = trader.rows.filter((row) => !row.result && row.type === "actual");
      if (openActualRows.length === 0) {
        return { trader, markPrice: null as number | null };
      }

      const candidates = await Promise.all(
        openActualRows.map(async (row) => ({ row, markPrice: await getMarkPrice(row.symbol!) })),
      );
      const positionValue = (c: (typeof candidates)[number]) =>
        c.row.quantity! * (c.markPrice ?? c.row.entry_price!);
      const top = candidates.sort((a, b) => positionValue(b) - positionValue(a))[0];
      return { trader: { ...trader, openRow: top.row }, markPrice: top.markPrice };
    }),
  );
}

// 인간지표 컨센서스: 유튜버들의 대표 포지션 방향을 1인 1표로 센다.
export function countDirections(traders: { trader: TraderGroup }[]) {
  const directions = traders
    .map(({ trader }) => trader.openRow?.direction)
    .filter((direction) => direction !== undefined);
  const shortCount = directions.filter((direction) => direction === "Short").length;
  return { longCount: directions.length - shortCount, shortCount };
}

export function getTraderStats(rows: PositionRow[], traderName: string): TraderStats {
  const decided = rows.filter((row) => row.trader_name === traderName && row.result);
  const wins = decided.filter((row) => row.result === "win").length;
  const draws = decided.filter((row) => row.result === "draw").length;
  const losses = decided.filter((row) => row.result === "loss").length;
  const total = decided.length;
  return { wins, draws, losses, total, winRate: getWinRate(wins, losses) };
}

// positions는 최신순(created_at desc) 정렬이어야 각 트레이더의 rows[0]가 최근 활동이 된다.
export function getTraderGroups(allPositions: PositionRow[]): TraderGroup[] {
  const positions = allPositions.filter((row) => !HIDDEN_TRADERS.includes(row.trader_name));
  const traderNames = [...new Set(positions.map((row) => row.trader_name))];
  return traderNames.map((traderName) => {
    const rows = positions.filter((row) => row.trader_name === traderName);
    return {
      traderName,
      traderImage: rows[0]?.trader_image ?? null,
      rows,
      openRow: rows.find((row) => !row.result) ?? null,
      stats: getTraderStats(positions, traderName),
    };
  });
}
