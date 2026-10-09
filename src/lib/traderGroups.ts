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

// 자동 추적이 안 되는 트레이더. 남아 있는 "열린 포지션"은 마지막 수동 기록일 뿐 지금 상태가 아니라서,
// 실시간 포지션·컨센서스·이달의 인간지표에선 빼고 종료된 기록과 승률만 보여준다.
// 사또: 방송마다 커스텀 썸네일을 걸어서 라이브 썸네일에 실제 화면이 안 나옴 (2026-10-06, 에이전트 config.ts 참고)
export const UNTRACKED_TRADERS: Record<string, string> = {
  사또: "방송 화면을 볼 수 없어 자동 추적 중단",
  // 자두두: 라이브 썸네일이 직접 만든 이미지라 처음부터 자동 추적 불가 (2026-10-09). 관리자가 수동으로 기록.
  자두두: "방송 화면을 볼 수 없어 자동 추적 안 함",
};

// 포지션 에이전트는 보이는 포지션을 전부 기록하므로, 트레이더마다 규모(수량 × 현재가)가 가장 큰
// 열린 포지션 1개를 대표로 고른다. 홈 포지션 표·인간지표 컨센서스·역발상 신호등이 같은 기준을 쓴다.
export async function withRepresentativePosition(traders: TraderGroup[]) {
  return Promise.all(
    traders.map(async (trader) => {
      const openActualRows = trader.rows.filter((row) => !row.result && row.type === "actual");
      if (openActualRows.length === 0 || UNTRACKED_TRADERS[trader.traderName]) {
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
export function getTraderGroups(positions: PositionRow[]): TraderGroup[] {
  const traderNames = [...new Set(positions.map((row) => row.trader_name))];
  return traderNames.map((traderName) => {
    const rows = positions.filter((row) => row.trader_name === traderName);
    return {
      traderName,
      traderImage: rows[0]?.trader_image ?? null,
      rows,
      openRow: UNTRACKED_TRADERS[traderName] ? null : (rows.find((row) => !row.result) ?? null),
      stats: getTraderStats(positions, traderName),
    };
  });
}
