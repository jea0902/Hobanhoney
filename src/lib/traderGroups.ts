import type { PositionRow } from "@/types/position";
import { getWinRate } from "@/lib/positionMath";

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
};

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
