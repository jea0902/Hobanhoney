// AI 호반꿀: 박호두가 포지션을 열면 같은 종목·레버리지·진입가로 반대 포지션을 잡고, 박호두가 닫을 때 같이 닫는다.
// 박호두는 큰 레버리지로 자주 잃다가 큰 추세 한 번에 크게 먹는 스타일이라, 매번 시드의 10%만 넣고
// 연속 2번 강제청산되면 7일 쉰다.
import {
  DEPOSIT_DAY,
  DEPOSIT_KRW,
  FUTURES_FEE,
  HOBANHONEY_BAN_DAYS,
  HOBANHONEY_FOLLOW_FROM,
  HOBANHONEY_MARGIN_RATIO,
  HOBANHONEY_MAX_LIQUIDATIONS,
  HOBANHONEY_TARGET,
  MAINTENANCE_MARGIN,
  START,
} from "./config.ts";
import { getTraderPositions, logEvent } from "./db.ts";
import type { EquityRow, HoldingRow, TradeRow } from "./ledger.ts";
import type { Market } from "./market.ts";
import { fetchMinuteCandles } from "./sources.ts";
import type { Candle } from "./sources.ts";

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

interface Followed {
  symbol: string; // DB 형식 "BTC/USDT"
  direction: "Long" | "Short"; // 호반꿀 방향 (박호두 반대)
  leverage: number;
  entryPrice: number;
  openedAt: number;
  closedAt: number | null;
  exitPrice: number | null;
  candles: Candle[];
}

interface OpenPosition {
  followed: Followed;
  quantity: number;
  margin: number;
  liquidationPrice: number;
}

type Event =
  | { time: number; order: 0; kind: "deposit" }
  | { time: number; order: 1; kind: "liquidation"; position: OpenPosition }
  | { time: number; order: 2; kind: "close"; followed: Followed }
  | { time: number; order: 3; kind: "open"; followed: Followed }
  | { time: number; order: 4; kind: "record"; date: string };

function kstDate(time: number) {
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 박호두 행 중 따라 할 수 있는 것: 아직 열려 있거나, 자동 기록이라 종료가격이 남은 것.
async function loadFollowed(now: number) {
  const rows = await getTraderPositions(HOBANHONEY_TARGET, HOBANHONEY_FOLLOW_FROM);
  const followed: Followed[] = [];
  for (const row of rows) {
    const exitPrice = Number(row.result_note?.match(/종료가격 ([\d.]+)/)?.[1] ?? NaN);
    const isOpen = row.result === null;
    if (!row.symbol || !row.entry_price || !row.leverage || (!isOpen && Number.isNaN(exitPrice)))
      continue;

    const openedAt = Date.parse(row.created_at);
    const closedAt = isOpen ? null : Date.parse(row.result_recorded_at!);
    const candles = await fetchMinuteCandles(
      row.symbol.replace("/", ""),
      openedAt,
      closedAt ?? now,
    );
    if (!candles) {
      // 강제청산 여부를 판정할 수 없으면 따라 하지 않는다.
      await logEvent(
        "error",
        "Bybit 1분봉이 없어 AI 호반꿀이 따라 하지 않음",
        `${row.symbol} ${row.created_at}`,
      );
      continue;
    }
    followed.push({
      symbol: row.symbol,
      direction: row.direction === "Long" ? "Short" : "Long",
      leverage: Number(row.leverage),
      entryPrice: Number(row.entry_price),
      openedAt,
      closedAt,
      exitPrice: isOpen ? null : exitPrice,
      candles,
    });
  }
  return followed;
}

function profit(position: OpenPosition, price: number) {
  const sign = position.followed.direction === "Long" ? 1 : -1;
  return sign * position.quantity * (price - position.followed.entryPrice);
}

// 미실현 손익은 그 시각 직전 1분봉 종가로. 증거금보다 더 잃을 수는 없다.
function valueAt(position: OpenPosition, time: number) {
  const candle = position.followed.candles.findLast((c) => c.time <= time);
  const price = candle?.close ?? position.followed.entryPrice;
  return Math.max(0, position.margin + profit(position, price));
}

// 격리 마진 기준 강제청산가: 증거금(1/레버리지)에서 유지증거금을 뺀 만큼 불리하게 움직이면 청산.
function liquidationPrice(direction: "Long" | "Short", entry: number, leverage: number) {
  const move = 1 / leverage - MAINTENANCE_MARGIN;
  return direction === "Long" ? entry * (1 - move) : entry * (1 + move);
}

export async function runHobanhoney(market: Market) {
  const now = Date.now();
  const followed = await loadFollowed(now);

  const events: Event[] = [];
  // 매월 10일 00:00 (KST) 입금
  for (
    let month = new Date(`${START.slice(0, 7)}-01T00:00:00Z`);
    ;
    month.setUTCMonth(month.getUTCMonth() + 1)
  ) {
    const time = Date.parse(
      `${month.toISOString().slice(0, 7)}-${String(DEPOSIT_DAY).padStart(2, "0")}T00:00:00+09:00`,
    );
    if (time > now) break;
    if (time >= Date.parse(`${START}T00:00:00+09:00`))
      events.push({ time, order: 0, kind: "deposit" });
  }
  for (const f of followed) {
    events.push({ time: f.openedAt, order: 3, kind: "open", followed: f });
    if (f.closedAt !== null)
      events.push({ time: f.closedAt, order: 2, kind: "close", followed: f });
  }
  // 하루 끝(KST)마다 자산 기록, 오늘은 지금 시각으로
  for (let time = Date.parse(`${START}T23:59:59+09:00`); ; time += DAY_MS) {
    events.push({
      time: Math.min(time, now),
      order: 4,
      kind: "record",
      date: kstDate(Math.min(time, now)),
    });
    if (time >= now) break;
  }
  const sortEvents = () => events.sort((a, b) => a.time - b.time || a.order - b.order);
  sortEvents();

  let cash = 0;
  let invested = 0;
  let liquidationStreak = 0;
  let bannedUntil = 0;
  const open = new Map<Followed, OpenPosition>();
  const trades: TradeRow[] = [];
  const equity: EquityRow[] = [];

  const trade = (
    position: OpenPosition,
    time: number,
    closing: boolean,
    price: number,
    reason: string,
  ) => {
    const long = position.followed.direction === "Long";
    trades.push({
      ai: "hobanhoney",
      traded_at: new Date(time).toISOString(),
      symbol: position.followed.symbol,
      side: closing ? (long ? "sell" : "cover") : long ? "buy" : "short",
      quantity: position.quantity,
      price,
      leverage: position.followed.leverage,
      reason,
    });
  };

  while (events.length > 0) {
    const event = events.shift()!;
    if (event.kind === "deposit") {
      const usd = DEPOSIT_KRW / market.price("KRW=X", kstDate(event.time))!;
      cash += usd;
      invested += usd;
    } else if (event.kind === "open") {
      const f = event.followed;
      if (event.time < bannedUntil) continue;
      const seed = cash + [...open.values()].reduce((sum, p) => sum + p.margin, 0);
      // 수수료(진입 금액 × 0.055%)까지 현금으로 낼 수 있는 만큼만
      const margin = Math.min(
        seed * HOBANHONEY_MARGIN_RATIO,
        cash / (1 + f.leverage * FUTURES_FEE),
      );
      if (margin < 1) continue;
      const position: OpenPosition = {
        followed: f,
        quantity: (margin * f.leverage) / f.entryPrice,
        margin,
        liquidationPrice: liquidationPrice(f.direction, f.entryPrice, f.leverage),
      };
      cash -= margin + margin * f.leverage * FUTURES_FEE;
      open.set(f, position);
      trade(
        position,
        event.time,
        false,
        f.entryPrice,
        `박호두 ${f.direction === "Long" ? "숏" : "롱"} 반대 진입 (증거금 $${margin.toFixed(2)}, 시드의 10%)`,
      );

      // 진입 다음 분부터 종료 전까지 1분봉 고가·저가가 강제청산가에 닿았는지 본다.
      const hit = f.candles.find(
        (c) =>
          c.time > event.time &&
          (f.closedAt === null || c.time < f.closedAt) &&
          (f.direction === "Long"
            ? c.low <= position.liquidationPrice
            : c.high >= position.liquidationPrice),
      );
      if (hit) {
        events.push({ time: hit.time, order: 1, kind: "liquidation", position });
        sortEvents();
      }
    } else if (event.kind === "liquidation") {
      const position = event.position;
      if (!open.has(position.followed)) continue;
      open.delete(position.followed);
      liquidationStreak += 1;
      let reason = `강제청산 (증거금 $${position.margin.toFixed(2)} 손실)`;
      if (liquidationStreak >= HOBANHONEY_MAX_LIQUIDATIONS) {
        bannedUntil = event.time + HOBANHONEY_BAN_DAYS * DAY_MS;
        liquidationStreak = 0;
        reason += ` → 연속 ${HOBANHONEY_MAX_LIQUIDATIONS}번째라 ${kstDate(bannedUntil)}까지 매매 금지`;
      }
      trade(position, event.time, true, position.liquidationPrice, reason);
    } else if (event.kind === "close") {
      const position = open.get(event.followed);
      if (!position) continue; // 금지 기간이라 안 땄거나, 이미 강제청산됨
      open.delete(event.followed);
      const exit = event.followed.exitPrice!;
      const pnl = profit(position, exit);
      cash += Math.max(0, position.margin + pnl) - position.quantity * exit * FUTURES_FEE;
      liquidationStreak = 0;
      trade(
        position,
        event.time,
        true,
        exit,
        `박호두 종료 따라 청산 (손익 ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)})`,
      );
    } else {
      const holdingValue = [...open.values()].reduce((sum, p) => sum + valueAt(p, event.time), 0);
      // 같은 날 기록이 두 번(마지막 날) 생기지 않게 덮어쓴다.
      if (equity.at(-1)?.date === event.date) equity.pop();
      equity.push({
        ai: "hobanhoney",
        date: event.date,
        cash,
        equity: cash + holdingValue,
        invested,
      });
    }
  }

  const holdings: HoldingRow[] = [...open.values()].map((p) => ({
    ai: "hobanhoney",
    symbol: p.followed.symbol,
    quantity: p.followed.direction === "Long" ? p.quantity : -p.quantity,
    avg_price: p.followed.entryPrice,
    leverage: p.followed.leverage,
    opened_at: new Date(p.followed.openedAt).toISOString(),
    value: valueAt(p, now),
  }));
  return { trades, holdings, equity, cash, invested };
}
