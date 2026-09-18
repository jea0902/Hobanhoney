import type { PositionRow } from "@/types/position";

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

export function getTraderStats(rows: PositionRow[], traderName: string): TraderStats {
  const decided = rows.filter((row) => row.trader_name === traderName && row.result);
  const wins = decided.filter((row) => row.result === "win").length;
  const draws = decided.filter((row) => row.result === "draw").length;
  const losses = decided.filter((row) => row.result === "loss").length;
  const total = decided.length;
  return { wins, draws, losses, total, winRate: total > 0 ? (wins / total) * 100 : null };
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
      openRow: rows.find((row) => !row.result) ?? null,
      stats: getTraderStats(positions, traderName),
    };
  });
}
