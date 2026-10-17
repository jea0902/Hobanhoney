// AI 마틴: BTC 변동성 수축 후 돌파 추세추종 + 마틴게일 (2026-10-17 사용자 설계).
// 일봉 종가가 200일선 위면 롱만, 아래면 숏만. 4시간봉 볼린저밴드가 좁아졌다가 그 방향으로 밴드를 뚫으면 5배로 진입한다.
// 일봉은 200일선만 보고, 나머지(밴드·진입·종료)는 전부 4시간봉 기준 (2026-10-18 사용자 정정).
// 종료는 두 가지뿐: 4시간봉 종가가 4시간봉 50선(50봉 단순평균)을 반대로 넘을 때(손익과 상관없이), 그리고 강제청산.
// (10/18: 20선은 큰 추세 중 짧은 조정에도 깨져서 50선으로, 마틴은 강제청산만이 아니라 손실 종료 전부로 — 사용자 결정)
// 1회차 증거금은 계좌의 1%, 손실로 끝나면(강제청산 포함, 수수료 포함 손익 기준) 다음 회차는 직전의 2배, 이익이면 1회차로. 다음 회차를 계좌가 못 버티면 1회차로 리셋.
// (10/18: 쿼터 켈리는 기록이 적어 흔들리고 같은 신호로 켈리만 쓰면 손실이라 1% 고정으로. 1.5배는 연패 손실을 못 메워 2배 유지)
// (처음 규칙은 주봉·일봉 이평선 정렬 + 4시간봉 20/50선 크로스였으나 매매가 너무 적고 추세 초입을 놓쳐서 바꿈)
import {
  DEPOSIT_DAY,
  DEPOSIT_KRW,
  FUTURES_FEE,
  MAINTENANCE_MARGIN,
  MARTIN_HISTORY_FROM,
  MARTIN_LEVERAGE,
  MARTIN_FIRST_RATIO,
  MARTIN_MULTIPLIER,
  START,
} from "./config.ts";
import type { EquityRow, HoldingRow, TradeRow } from "./ledger.ts";
import type { Market } from "./market.ts";
import { fetchCandles } from "./sources.ts";

const HOUR_MS = 3_600_000;
const FOUR_HOURS_MS = 4 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;
const SYMBOL = "BTC/USDT";
// 격리 마진 기준: 증거금(1/레버리지)에서 유지증거금을 뺀 만큼 불리하게 움직이면 강제청산 (AI 호반꿀과 같음)
const LIQUIDATION_MOVE = 1 / MARTIN_LEVERAGE - MAINTENANCE_MARGIN;
// 볼린저밴드 표준값: 4시간봉 20개 평균 ± 표준편차 2배
const BAND_BARS = 20;
const BAND_WIDTH = 2;
// "좁아졌다" = 밴드 폭이 최근 6개월(4시간봉 1,080개) 중 하위 20%. 그 상태가 최근 하루(6봉) 안에 있었으면 돌파를 인정한다.
const SQUEEZE_LOOKBACK = 1080;
const SQUEEZE_QUANTILE = 0.2;
const SQUEEZE_RECENT = 6;
const EXIT_BARS = 50;

interface Ema {
  length: number;
  value: number;
  count: number;
}

interface Position {
  direction: 1 | -1;
  entryPrice: number;
  quantity: number;
  margin: number; // 0이면 시작 전 매매 — 계좌엔 반영하지 않고, 시작일에 신호 상태(포지션 중인지)를 이어 받는 데만 쓴다
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

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))];
}

export async function runMartin(market: Market) {
  const now = Date.now();
  const from = Date.parse(`${START}T00:00:00+09:00`);
  // 일봉은 Bybit과 같은 UTC 경계로 4시간봉을 묶어서 만든다 (Bybit 일봉은 분 단위 간격으로 받을 수 없음).
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

  const d200 = ema(200);
  // 마지막으로 끝난 일봉의 종가 (200일선 위·아래 판단용)
  let dayClose = 0;
  const closes: number[] = [];
  const widths: number[] = [];

  let cash = 0;
  let invested = 0;
  let round = 1;
  let baseMargin = 0;
  let position: Position | null = null;
  let lastClose = 0;
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

    closes.push(close);
    const recent = closes.slice(-BAND_BARS);
    const middle = mean(recent);
    const deviation = Math.sqrt(mean(recent.map((c) => (c - middle) ** 2)));
    const upper = middle + BAND_WIDTH * deviation;
    const lower = middle - BAND_WIDTH * deviation;
    widths.push((upper - lower) / middle);
    const exitLine = mean(closes.slice(-EXIT_BARS));

    // 10일 00:00 입금이 9일 마지막 봉에 들어가 9일 기록으로 찍히지 않게, 그 시각이 지난 봉에서 넣는다 (AI 워뇨띠와 같음)
    while (deposits.length > 0 && deposits[0] < closeTime) {
      const usd = DEPOSIT_KRW / market.price("KRW=X", kstDate(deposits.shift()!))!;
      cash += usd;
      invested += usd;
    }

    if (position) {
      const p = position;
      const liquidationPrice = p.entryPrice * (1 - p.direction * LIQUIDATION_MOVE);
      // 한 봉 안의 순서는 알 수 없어서 강제청산을 50선 종료보다 먼저 본다
      const liquidated = p.direction > 0 ? low <= liquidationPrice : high >= liquidationPrice;
      const crossedBack = p.direction > 0 ? close < exitLine : close > exitLine;
      if (liquidated || crossedBack) {
        const exitPrice = liquidated ? liquidationPrice : close;
        const exitFee = liquidated ? 0 : p.quantity * exitPrice * FUTURES_FEE;
        const pnl = liquidated ? -p.margin : p.direction * p.quantity * (exitPrice - p.entryPrice);
        position = null;

        if (p.margin > 0) {
          cash += liquidated ? 0 : positionValue(p, exitPrice) - exitFee;
          const entryFee = p.quantity * p.entryPrice * FUTURES_FEE;
          const lost = pnl - entryFee - exitFee < 0;
          const nextRound = lost ? round + 1 : 1;
          const why = liquidated
            ? `강제청산 (증거금 $${p.margin.toFixed(2)} 손실)`
            : `4시간봉 종가가 50선 ${p.direction > 0 ? "아래" : "위"}로 → 종료, 손익 ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
          const next = lost ? `다음은 ${nextRound}회차 (증거금 2배)` : "다음은 1회차";
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

    // 일봉이 끝나는 봉에서 일봉 200일선을 갱신한다.
    if (closeTime % DAY_MS === 0) {
      update(d200, close);
      dayClose = close;
    }

    const ready = d200.count >= 200 && widths.length >= SQUEEZE_LOOKBACK;
    if (!position && ready) {
      const threshold = quantile(widths.slice(-SQUEEZE_LOOKBACK), SQUEEZE_QUANTILE);
      const squeezed = widths.slice(-SQUEEZE_RECENT - 1, -1).some((w) => w <= threshold);
      const direction =
        dayClose > d200.value && close > upper
          ? 1
          : dayClose < d200.value && close < lower
            ? -1
            : 0;
      if (squeezed && direction !== 0) {
        let margin = 0;
        let reason = "";
        if (closeTime >= from) {
          let note = "";
          if (round === 1) baseMargin = MARTIN_FIRST_RATIO * cash;
          margin = baseMargin * MARTIN_MULTIPLIER ** (round - 1);
          // 진입 수수료까지 현금으로 낼 수 있어야 한다
          if (margin * (1 + MARTIN_LEVERAGE * FUTURES_FEE) > cash) {
            note = ` (${round}회차 증거금 $${margin.toFixed(2)}를 계좌가 못 버텨 1회차로 리셋)`;
            round = 1;
            baseMargin = MARTIN_FIRST_RATIO * cash;
            margin = baseMargin;
          }
          if (margin < 1) margin = 0;
          reason =
            `일봉 200일선 ${direction > 0 ? "위" : "아래"}, 좁아진 4시간봉 볼린저밴드 ${direction > 0 ? "상단" : "하단"} 돌파, ` +
            `${round}회차 증거금 $${margin.toFixed(2)}${note}`;
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
