import type { PositionRow } from "../../src/types/position.ts";
import type { ScreenPosition, ScreenReading } from "./gemma.ts";

export type Action =
  | { kind: "open"; position: ScreenPosition }
  | { kind: "update"; row: PositionRow; position: ScreenPosition; reason: string }
  | { kind: "close"; row: PositionRow; note: string };

// 거래소는 같은 종목 + 같은 방향을 한 포지션으로 합치므로 이 둘이 포지션의 이름표다.
export function positionKey(symbol: string, direction: string) {
  return `${symbol.replace(/\//g, "").toUpperCase()}|${direction}`;
}

function isClose(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= Math.abs(b) * tolerance;
}

// 숫자끼리 앞뒤가 안 맞으면 잘못 읽은 것으로 보고 이 화면을 버린다.
export function isConsistent(p: ScreenPosition) {
  const markFromValue = p.positionValue ? p.positionValue / p.size : null;
  // 칸 이름이 없는 화면에서 강제청산가를 현재가로 잘못 읽은 적이 있다 (박호두).
  if (
    p.markPrice !== null &&
    markFromValue !== null &&
    !isClose(markFromValue, p.markPrice, 0.02)
  ) {
    return false;
  }

  const markPrice = p.markPrice ?? markFromValue;
  if (markPrice === null) return true;

  if (p.liqPrice !== null) {
    if (p.direction === "Long" && p.liqPrice >= markPrice) return false;
    if (p.direction === "Short" && p.liqPrice <= markPrice) return false;
  }

  if (p.unrealizedPnl !== null) {
    const move = (markPrice - p.entryPrice) / p.entryPrice;
    // 진입가와 현재가 차이가 아주 작으면 수수료 때문에 손익 부호가 뒤집혀 보일 수 있다.
    if (Math.abs(move) >= 0.002) {
      const expectedSign = p.direction === "Long" ? Math.sign(move) : -Math.sign(move);
      if (Math.sign(p.unrealizedPnl) !== expectedSign) return false;
    }
  }
  return true;
}

// 강제청산가·손익은 오버레이에 가려지거나 매번 변하므로 비교하지 않는다.
export function isSameReading(a: ScreenReading, b: ScreenReading) {
  const summarize = (r: ScreenReading) =>
    r.positions
      .map((p) => `${positionKey(p.symbol, p.direction)}|${p.size}|${p.entryPrice}`)
      .sort()
      .join(",") + `#${r.positionsCount}`;
  return summarize(a) === summarize(b);
}

// 확정된(연속 일치한) 화면을 DB의 열린 포지션과 비교해서 생성·수정·종료를 정한다.
export async function planActions(
  openRows: PositionRow[],
  reading: ScreenReading,
  getPriceRange: (symbol: string, fromMs: number) => Promise<{ low: number; high: number } | null>,
  lastChangedAt: (row: PositionRow) => number,
): Promise<Action[]> {
  const actions: Action[] = [];
  const matchedRowIds = new Set<string>();

  for (const position of reading.positions) {
    const key = positionKey(position.symbol, position.direction);
    const row = openRows.find((r) => positionKey(r.symbol ?? "", r.direction) === key);
    if (!row) {
      actions.push({ kind: "open", position });
      continue;
    }
    matchedRowIds.add(row.id);
    actions.push(...(await compareWithRow(row, position, getPriceRange, lastChangedAt(row))));
  }

  // 개수 표시보다 읽힌 행이 적으면 스크롤 등으로 안 보이는 행이 있는 것이라 종료로 보지 않는다.
  const someRowsHidden =
    reading.positionsCount !== null && reading.positionsCount > reading.positions.length;
  if (!someRowsHidden) {
    for (const row of openRows) {
      if (!matchedRowIds.has(row.id)) {
        actions.push({ kind: "close", row, note: "포지션 목록에서 사라짐" });
      }
    }
  }
  return actions;
}

async function compareWithRow(
  row: PositionRow,
  position: ScreenPosition,
  getPriceRange: (symbol: string, fromMs: number) => Promise<{ low: number; high: number } | null>,
  sinceMs: number,
): Promise<Action[]> {
  const oldSize = row.quantity ?? 0;
  const oldEntry = row.entry_price ?? 0;
  const sameSize = isClose(position.size, oldSize, 1e-6);
  const sameEntry = isClose(position.entryPrice, oldEntry, 1e-4);

  if (sameSize && sameEntry) {
    const changed =
      (position.leverage !== null && position.leverage !== row.leverage) ||
      (position.liqPrice !== null && position.liqPrice !== row.liquidation_price);
    return changed ? [{ kind: "update", row, position, reason: "레버리지/강제청산가 변경" }] : [];
  }

  const reopen: Action[] = [
    { kind: "close", row, note: "방송 공백 중 종료 후 재진입으로 판단" },
    { kind: "open", position },
  ];

  if (position.size > oldSize) {
    // 평균 진입가 공식을 거꾸로 풀어 이번에 추가로 산 가격을 구한다.
    const addedPrice =
      (position.size * position.entryPrice - oldSize * oldEntry) / (position.size - oldSize);
    const range = await getPriceRange(position.symbol, sinceMs);
    // 시세를 못 구하면(오래됐거나 Bybit에 없는 종목) 판별할 근거가 없으니 추가매수로 본다.
    const plausible =
      range === null || (addedPrice >= range.low * 0.995 && addedPrice <= range.high * 1.005);
    if (!plausible) return reopen;
    return [
      { kind: "update", row, position, reason: `추가매수 (역산 매수가 ${addedPrice.toFixed(6)})` },
    ];
  }

  // 부분 종료는 평균 진입가가 그대로다. 진입가까지 바뀌었으면 종료 후 새로 잡은 것이다.
  if (position.size < oldSize && sameEntry) {
    return [{ kind: "update", row, position, reason: "부분 종료" }];
  }
  return reopen;
}
