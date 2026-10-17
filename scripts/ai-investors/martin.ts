// AI 마틴: BTC 추세추종 + 마틴게일 + 켈리 (2026-10-17 사용자 설계).
// 방향은 주봉 20/50선·일봉 50/200선이 같은 쪽일 때만 정하고, 그 방향으로 4시간봉 20선이 50선을 뚫을 때 20배로 진입한다.
// 일봉 종가가 50일선을 반대로 2일 연속 넘으면 추세가 끝난 걸로 보고 나온다.
// 1회차 증거금은 하프 켈리, 손실로 끝나면 다음 회차는 직전의 2배, 이익이면 1회차로. 다음 회차를 계좌가 못 버티면 1회차로 리셋.
import {
  DEPOSIT_DAY,
  DEPOSIT_KRW,
  FUTURES_FEE,
  MAINTENANCE_MARGIN,
  MARTIN_HISTORY_FROM,
  MARTIN_LEVERAGE,
  MARTIN_MIN_RATIO,
  START,
} from "./config.ts";
import type { EquityRow, HoldingRow, TradeRow } from "./ledger.ts";
import type { Market } from "./market.ts";
import { fetchCandles } from "./sources.ts";

const HOUR_MS = 3_600_000;
const FOUR_HOURS_MS = 4 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;
const SYMBOL = "BTC/USDT";
// 격리 마진 기준: 증거금(1/레버리지)에서 유지증거금을 뺀 만큼 불리하게 움직이면 강제청산 (AI 호반꿀과 같음)
const LIQUIDATION_MOVE = 1 / MARTIN_LEVERAGE - MAINTENANCE_MARGIN;

interface Ema {
  length: number;
  value: number;
  count: number;
}

interface Position {
  direction: 1 | -1;
  entryPrice: number;
  quantity: number;
  margin: number; // 0이면 시작 전 매매 — 계좌엔 반영하지 않고 켈리 계산용 기록만 남긴다
  openedAt: number;
}

function ema(length: number): Ema {
  return { length, value: 0, count: 0 };
}

function update(average: Ema, close: number) {
  average.value =
    average.count === 0
      ? close
      : average.value + (2 / (average.length + 1)) * (close - average.value);
  average.count += 1;
}

function kstDate(time: number) {
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function mean(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// 지금까지 끝난 매매(증거금 대비 수익률)로 구한 하프 켈리. 계좌 대비 1회차 증거금 비율.
function kelly(returns: number[]) {
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  if (wins.length === 0 || losses.length === 0)
    return { ratio: MARTIN_MIN_RATIO, winRate: 0, payoff: 0 };
  const winRate = wins.length / returns.length;
  const payoff = mean(wins) / -mean(losses);
  const half = (winRate - (1 - winRate) / payoff) / 2;
  return { ratio: Math.max(MARTIN_MIN_RATIO, half), winRate, payoff };
}

export async function runMartin(market: Market) {
  const now = Date.now();
  const from = Date.parse(`${START}T00:00:00+09:00`);
  // 일봉·주봉은 Bybit과 같은 UTC 경계로 4시간봉을 묶어서 만든다 (Bybit 일봉·주봉은 분 단위 간격으로 받을 수 없음).
  const candles = await fetchCandles(
    SYMBOL.replace("/", ""),
    Date.parse(`${MARTIN_HISTORY_FROM}T00:00:00Z`),
    now,
    240,
  );
  if (!candles) throw new Error("AI 마틴: BTCUSDT 4시간봉을 받지 못함");

  const deposits: number[] = [];
  for (
    let month = new Date(`${START.slice(0, 7)}-01T00:00:00Z`);
    ;
    month.setUTCMonth(month.getUTCMonth() + 1)
  ) {
    const time = Date.parse(
      `${month.toISOString().slice(0, 7)}-${String(DEPOSIT_DAY).padStart(2, "0")}T00:00:00+09:00`,
    );
    if (time > now) break;
    if (time >= from) deposits.push(time);
  }

  const h20 = ema(20);
  const h50 = ema(50);
  const d50 = ema(50);
  const d200 = ema(200);
  const w20 = ema(20);
  const w50 = ema(50);
  // 일봉 종가가 50일선 아래(위)에서 연속으로 마감한 날 수
  let daysBelow = 0;
  let daysAbove = 0;

  let cash = 0;
  let invested = 0;
  let round = 1;
  let baseMargin = 0;
  let position: Position | null = null;
  let lastClose = 0;
  const returns: number[] = [];
  const trades: TradeRow[] = [];
  const equity: EquityRow[] = [];

  const record = (
    time: number,
    side: TradeRow["side"],
    quantity: number,
    price: number,
    reason: string,
  ) => {
    trades.push({
      ai: "martin",
      traded_at: new Date(time).toISOString(),
      symbol: SYMBOL,
      side,
      quantity,
      price,
      leverage: MARTIN_LEVERAGE,
      reason,
    });
  };
  // 격리 마진이라 증거금보다 더 잃지는 않는다
  const positionValue = (p: Position, price: number) =>
    Math.max(0, p.margin + p.direction * p.quantity * (price - p.entryPrice));

  for (const candle of candles) {
    const closeTime = candle.time + FOUR_HOURS_MS;
    // 아직 안 끝난 봉은 쓰지 않는다
    if (closeTime > now) break;
    const { high, low, close } = candle;
    lastClose = close;

    const before20 = h20.value;
    const before50 = h50.value;
    update(h20, close);
    update(h50, close);
    const isDayEnd = closeTime % DAY_MS === 0;
    if (isDayEnd) {
      update(d50, close);
      update(d200, close);
      daysBelow = close < d50.value ? daysBelow + 1 : 0;
      daysAbove = close > d50.value ? daysAbove + 1 : 0;
    }
    // 1970-01-01은 목요일이라 4일을 빼면 월요일 00:00 (UTC) 경계가 된다
    if ((closeTime - 4 * DAY_MS) % WEEK_MS === 0) {
      update(w20, close);
      update(w50, close);
    }

    // 10일 00:00 입금이 9일 마지막 봉에 들어가 9일 기록으로 찍히지 않게, 그 시각이 지난 봉에서 넣는다 (AI 워뇨띠와 같음)
    while (deposits.length > 0 && deposits[0] < closeTime) {
      const usd = DEPOSIT_KRW / market.price("KRW=X", kstDate(deposits.shift()!))!;
      cash += usd;
      invested += usd;
    }

    if (position) {
      const p = position;
      const liquidationPrice = p.entryPrice * (1 - p.direction * LIQUIDATION_MOVE);
      // 한 봉 안의 순서는 알 수 없어서 강제청산을 추세 종료보다 먼저 본다
      const liquidated = p.direction > 0 ? low <= liquidationPrice : high >= liquidationPrice;
      const trendBroken = isDayEnd && (p.direction > 0 ? daysBelow >= 2 : daysAbove >= 2);
      if (liquidated || trendBroken) {
        const exitPrice = liquidated ? liquidationPrice : close;
        const entryFee = p.quantity * p.entryPrice * FUTURES_FEE;
        const exitFee = liquidated ? 0 : p.quantity * exitPrice * FUTURES_FEE;
        const pnl = liquidated ? -p.margin : p.direction * p.quantity * (exitPrice - p.entryPrice);
        // 증거금 대비 수익률은 증거금 크기와 상관없어서, 시작 전 매매(증거금 0)도 같은 식으로 구한다
        const move = p.direction * (exitPrice / p.entryPrice - 1);
        returns.push(
          liquidated ? -1 : MARTIN_LEVERAGE * (move - FUTURES_FEE * (1 + exitPrice / p.entryPrice)),
        );
        position = null;

        if (p.margin > 0) {
          cash += liquidated ? 0 : positionValue(p, exitPrice) - exitFee;
          const net = pnl - entryFee - exitFee;
          const nextRound = net < 0 ? round + 1 : 1;
          const why = liquidated
            ? `강제청산 (증거금 $${p.margin.toFixed(2)} 손실)`
            : `일봉 종가가 50일선 ${p.direction > 0 ? "아래" : "위"}로 2일 연속 → 추세 종료, 손익 ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
          const next = net < 0 ? `다음은 ${nextRound}회차 (증거금 2배)` : "다음은 1회차";
          record(
            closeTime,
            p.direction > 0 ? "sell" : "cover",
            p.quantity,
            exitPrice,
            `${why} → ${next}`,
          );
          round = nextRound;
        }
      }
    }

    const ready = w50.count >= 50 && d200.count >= 200 && h50.count >= 50;
    const direction = !ready
      ? 0
      : w20.value > w50.value && d50.value > d200.value
        ? 1
        : w20.value < w50.value && d50.value < d200.value
          ? -1
          : 0;
    const crossed =
      direction > 0
        ? before20 <= before50 && h20.value > h50.value
        : direction < 0 && before20 >= before50 && h20.value < h50.value;
    // 이미 추세 종료 조건에 걸려 있으면 들어가자마자 나오게 되니 쉰다
    const broken = direction > 0 ? daysBelow >= 2 : daysAbove >= 2;
    if (!position && direction !== 0 && crossed && !broken) {
      let margin = 0;
      let reason = "";
      if (closeTime >= from) {
        const k = kelly(returns);
        let note = "";
        if (round === 1) baseMargin = k.ratio * cash;
        margin = baseMargin * 2 ** (round - 1);
        // 진입 수수료까지 현금으로 낼 수 있어야 한다
        if (margin * (1 + MARTIN_LEVERAGE * FUTURES_FEE) > cash) {
          note = `, ${round}회차 증거금 $${margin.toFixed(2)}를 계좌가 못 버텨 1회차로 리셋`;
          round = 1;
          baseMargin = k.ratio * cash;
          margin = baseMargin;
        }
        if (margin < 1) margin = 0;
        const kellyText =
          k.winRate > 0
            ? `켈리: 승률 ${(k.winRate * 100).toFixed(0)}%·손익비 ${k.payoff.toFixed(2)} → 1회차는 계좌의 ${(k.ratio * 100).toFixed(1)}%`
            : `켈리 계산할 기록 부족 → 1회차는 계좌의 ${(k.ratio * 100).toFixed(1)}%`;
        reason =
          `4시간봉 20선이 50선을 ${direction > 0 ? "위" : "아래"}로 돌파 (주봉·일봉 ${direction > 0 ? "상승" : "하락"} 추세), ` +
          `${round}회차 증거금 $${margin.toFixed(2)} (${kellyText}${note})`;
      }

      position = {
        direction,
        entryPrice: close,
        quantity: (margin * MARTIN_LEVERAGE) / close,
        margin,
        openedAt: closeTime,
      };
      if (margin > 0) {
        cash -= margin + position.quantity * close * FUTURES_FEE;
        record(closeTime, direction > 0 ? "buy" : "short", position.quantity, close, reason);
      }
    }

    if (closeTime > from) {
      // 같은 날 기록은 마지막 값으로 덮어쓴다 (하루 끝 자산)
      const date = kstDate(closeTime - 1);
      if (equity.at(-1)?.date === date) equity.pop();
      const held = position && position.margin > 0 ? positionValue(position, close) : 0;
      equity.push({ ai: "martin", date, cash, equity: cash + held, invested });
    }
  }

  const holdings: HoldingRow[] =
    position && position.margin > 0
      ? [
          {
            ai: "martin",
            symbol: SYMBOL,
            quantity: position.direction * position.quantity,
            avg_price: position.entryPrice,
            leverage: MARTIN_LEVERAGE,
            opened_at: new Date(position.openedAt).toISOString(),
            value: positionValue(position, lastClose),
          },
        ]
      : [];
  return { trades, holdings, equity };
}
