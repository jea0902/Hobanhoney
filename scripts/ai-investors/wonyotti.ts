// AI 워뇨띠: 워뇨띠의 2018~2021 BitMEX 실제 기록에서 뽑은 "매매 습관" + 본인이 100문 100답에서 밝힌 원칙 (TODO.md 25·27번).
// 단타 숫자는 수익률을 보고 고른 게 아니라 기록의 분포에서 가져왔다. 단타만으로는 2018~2021·2022~2026 백테스트 모두
// 손실이었고, "상승장에선 자산 30%를 비트로"(기본 포지션)와 "거래량 적으면 휩쏘"(거래량 조건)를 더하니 두 기간 모두 플러스.
// 다만 수익 대부분은 기본 포지션에서 나온다 — 그 사실을 상세 페이지에 그대로 밝힌다.
import { DEPOSIT_DAY, DEPOSIT_KRW, FUTURES_FEE, MAKER_FEE, START } from "./config.ts";
import type { EquityRow, HoldingRow, TradeRow } from "./ledger.ts";
import type { Market } from "./market.ts";
import { fetchCandles } from "./sources.ts";
import type { Candle } from "./sources.ts";

const HOUR_MS = 3_600_000;
const KST_OFFSET_MS = 9 * HOUR_MS;

interface CoinRule {
  symbol: string; // DB 형식
  takeProfit: number; // 이긴 포지션의 가격 움직임 중간값
  addAt: number; // 2분할 진입의 두 번째 가격(첫 진입가 대비)의 중간값
  stopLoss: number; // 진 포지션 손실 폭의 90% 지점
  maxHours: number; // 보유 시간 중간값 근처 (기록과 손실 폭·보유 시간이 가장 닮게 맞춤)
  volatilityQuantile: number; // 24시간 변동폭이 최근 30일 중 이 분위 이상일 때만 진입
  restHours: number; // 청산 후 쉬는 시간 (거래 빈도를 기록에 맞춤)
}

const RULES: CoinRule[] = [
  {
    symbol: "BTC/USDT",
    takeProfit: 0.006,
    addAt: 0.003,
    stopLoss: 0.032,
    maxHours: 8,
    volatilityQuantile: 0.5,
    restHours: 12,
  },
  {
    symbol: "ETH/USDT",
    takeProfit: 0.0115,
    addAt: 0.004,
    stopLoss: 0.078,
    maxHours: 10,
    volatilityQuantile: 0.75,
    restHours: 48,
  },
];

// 2분할 진입(50:50) 각각 자산의 25% → 두 종목이 다 채워져도 단타는 합쳐서 1배
const ENTRY_RATIO = 0.25;
const RANGE_HOURS = 4;
const VOLATILITY_HOURS = 24;
const VOLATILITY_LOOKBACK_HOURS = 24 * 30;
// 기본 포지션: BTC가 50일 평균 위(상승 추세)면 자산의 30%를 BTC 롱으로 깔고 간다 (100문 100답 Q8·Q30·Q54)
const CORE_SYMBOL = "BTC/USDT";
const CORE_RATIO = 0.3;
const TREND_HOURS = 24 * 50;
const HISTORY_HOURS = Math.max(VOLATILITY_LOOKBACK_HOURS + VOLATILITY_HOURS, TREND_HOURS);

interface Position {
  direction: 1 | -1;
  quantity: number;
  avgPrice: number;
  firstPrice: number;
  firstQuantity: number;
  openedAt: number;
  added: boolean;
}

function kstDate(time: number) {
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))];
}

// i번째 봉까지 n개 봉의 고가·저가
function range(candles: Candle[], i: number, n: number) {
  let high = -Infinity;
  let low = Infinity;
  for (let k = i - n + 1; k <= i; k++) {
    high = Math.max(high, candles[k].high);
    low = Math.min(low, candles[k].low);
  }
  return { high, low };
}

export async function runWonyotti(market: Market) {
  const now = Date.now();
  const from = Date.parse(`${START}T00:00:00+09:00`);
  // 변동폭·거래량 30일 분위와 50일 평균을 계산하려면 시작 전 50일치가 더 필요하다.
  const fetchFrom = from - HISTORY_HOURS * HOUR_MS;
  const candlesBySymbol = new Map<string, Candle[]>();
  for (const rule of RULES) {
    const candles = await fetchCandles(rule.symbol.replace("/", ""), fetchFrom, now, 60);
    if (!candles) throw new Error(`AI 워뇨띠: ${rule.symbol} 1시간봉을 받지 못함`);
    // 아직 안 끝난 봉은 쓰지 않는다
    candlesBySymbol.set(
      rule.symbol,
      candles.filter((c) => c.time + HOUR_MS <= now),
    );
  }

  // 다른 AI와 같은 조건: 매월 10일 00:00 (KST)에 100만원 입금, 출금 없음 (2026-10-17 사용자 결정 — 처음엔 600만원 한 번 입금 + 출금 습관이었음)
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

  let cash = 0;
  let invested = 0;
  const positions = new Map<string, Position>();
  let core: { quantity: number; avgPrice: number; openedAt: number } | null = null;
  const restUntil = new Map<string, number>();
  const lastClose = new Map<string, number>();
  const trades: TradeRow[] = [];
  const equity: EquityRow[] = [];

  const totalEquity = () => {
    let total = cash;
    for (const [symbol, p] of positions)
      total += p.direction * p.quantity * (lastClose.get(symbol)! - p.avgPrice);
    if (core) total += core.quantity * (lastClose.get(CORE_SYMBOL)! - core.avgPrice);
    return total;
  };
  const record = (
    time: number,
    symbol: string,
    side: TradeRow["side"],
    quantity: number,
    price: number,
    reason: string,
  ) => {
    trades.push({
      ai: "wonyotti",
      traded_at: new Date(time).toISOString(),
      symbol,
      side,
      quantity,
      price,
      leverage: null,
      reason,
    });
  };

  // 두 종목의 1시간봉 시작 시각을 합쳐서 시간순으로 돈다.
  const times = [...new Set([...candlesBySymbol.values()].flat().map((c) => c.time))]
    .filter((t) => t >= from)
    .sort((a, b) => a - b);
  const indexBySymbol = new Map(
    RULES.map((rule) => [
      rule.symbol,
      new Map(candlesBySymbol.get(rule.symbol)!.map((c, i) => [c.time, i])),
    ]),
  );

  for (const time of times) {
    const closeTime = time + HOUR_MS;
    let deposited = false;
    while (deposits.length > 0 && deposits[0] <= closeTime) {
      const usd = DEPOSIT_KRW / market.price("KRW=X", kstDate(deposits.shift()!))!;
      cash += usd;
      invested += usd;
      deposited = true;
    }

    for (const rule of RULES) {
      const candles = candlesBySymbol.get(rule.symbol)!;
      const i = indexBySymbol.get(rule.symbol)!.get(time);
      if (i === undefined) continue;
      const { high, low, close } = candles[i];
      lastClose.set(rule.symbol, close);

      // 기본 포지션: 상승 추세로 바뀌면 자산 30% 롱, 입금 때마다 30%로 다시 맞추고, 50일 평균 아래로 내려가면 정리
      if (rule.symbol === CORE_SYMBOL && i >= TREND_HOURS) {
        let sum = 0;
        for (let k = i - TREND_HOURS + 1; k <= i; k++) sum += candles[k].close;
        const uptrend = close > sum / TREND_HOURS;
        if (uptrend && (!core || deposited)) {
          const change = (totalEquity() * CORE_RATIO) / close - (core?.quantity ?? 0);
          if (Math.abs(change * close) >= 1) {
            cash -= Math.abs(change) * close * FUTURES_FEE;
            if (!core) core = { quantity: 0, avgPrice: close, openedAt: closeTime };
            if (change > 0) {
              core.avgPrice =
                (core.quantity * core.avgPrice + change * close) / (core.quantity + change);
            } else {
              cash += -change * (close - core.avgPrice);
            }
            core.quantity += change;
            record(
              closeTime,
              CORE_SYMBOL,
              change > 0 ? "buy" : "sell",
              Math.abs(change),
              close,
              core.quantity === Math.abs(change)
                ? "기본 포지션 진입: BTC가 50일 평균 위 → 자산 30% 롱"
                : "기본 포지션 비중을 자산 30%로 맞춤 (입금 반영)",
            );
          }
        } else if (!uptrend && core) {
          const pnl = core.quantity * (close - core.avgPrice);
          cash += pnl - core.quantity * close * FUTURES_FEE;
          record(
            closeTime,
            CORE_SYMBOL,
            "sell",
            core.quantity,
            close,
            `기본 포지션 정리: BTC가 50일 평균 아래로, 손익 ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
          );
          core = null;
        }
      }

      const p = positions.get(rule.symbol);
      if (p) {
        const d = p.direction;
        const worst = d > 0 ? low : high;
        const best = d > 0 ? high : low;
        // 한 봉 안의 순서는 알 수 없어서 불리한 쪽(2분할 두 번째 진입 → 손절)을 먼저 본다.
        if (!p.added && d * (worst / p.firstPrice - 1) <= -rule.addAt) {
          const price = p.firstPrice * (1 - d * rule.addAt);
          const quantity = (p.firstQuantity * p.firstPrice) / price; // 첫 진입과 같은 금액
          cash -= quantity * price * MAKER_FEE;
          p.avgPrice = (p.quantity * p.avgPrice + quantity * price) / (p.quantity + quantity);
          p.quantity += quantity;
          p.added = true;
          record(
            closeTime,
            rule.symbol,
            d > 0 ? "buy" : "short",
            quantity,
            price,
            `2분할 두 번째 진입 (첫 진입가에서 ${(rule.addAt * 100).toFixed(1)}%)`,
          );
        }
        const stopPrice = p.avgPrice * (1 - d * rule.stopLoss);
        const takePrice = p.avgPrice * (1 + d * rule.takeProfit);
        let exit: { price: number; fee: number; reason: string } | null = null;
        if (d * (worst - stopPrice) <= 0) {
          exit = {
            price: stopPrice,
            fee: FUTURES_FEE,
            reason: `손절 (평균가 대비 -${(rule.stopLoss * 100).toFixed(1)}%)`,
          };
        } else if (d * (best - takePrice) >= 0) {
          exit = {
            price: takePrice,
            fee: MAKER_FEE,
            reason: `익절 (평균가 대비 +${(rule.takeProfit * 100).toFixed(2)}%)`,
          };
        } else if (closeTime - p.openedAt >= rule.maxHours * HOUR_MS) {
          exit = { price: close, fee: FUTURES_FEE, reason: `${rule.maxHours}시간 지나 정리` };
        }
        if (exit) {
          const pnl = d * p.quantity * (exit.price - p.avgPrice);
          cash += pnl - p.quantity * exit.price * exit.fee;
          positions.delete(rule.symbol);
          restUntil.set(rule.symbol, closeTime + rule.restHours * HOUR_MS);
          record(
            closeTime,
            rule.symbol,
            d > 0 ? "sell" : "cover",
            p.quantity,
            exit.price,
            `${exit.reason}, 손익 ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
          );
        }
        continue;
      }

      // 진입: 시장이 평소보다 출렁이고 거래량도 평소 이상일 때, 4시간 범위 아래 1/3이면 롱·위 1/3이면 숏
      // (진입 위치·변동폭은 기록에서, 거래량 조건은 "거래량 적으면 웬만한 움직임은 휩쏘" Q64에서)
      if (closeTime < (restUntil.get(rule.symbol) ?? 0)) continue;
      if (i < HISTORY_HOURS) continue;
      const volatilities: number[] = [];
      const volumes: number[] = [];
      for (let k = i - VOLATILITY_LOOKBACK_HOURS + 1; k <= i; k++) {
        const r = range(candles, k, VOLATILITY_HOURS);
        volatilities.push(r.high / r.low - 1);
        let volume = 0;
        for (let m = k - VOLATILITY_HOURS + 1; m <= k; m++) volume += candles[m].volume;
        volumes.push(volume);
      }
      const volatility = volatilities.at(-1)!;
      const threshold = quantile(volatilities, rule.volatilityQuantile);
      if (volatility < threshold) continue;
      if (volumes.at(-1)! < quantile(volumes, 0.5)) continue;
      const r = range(candles, i, RANGE_HOURS);
      const where = (close - r.low) / (r.high - r.low);
      const direction = where <= 1 / 3 ? 1 : where >= 2 / 3 ? -1 : 0;
      if (direction === 0) continue;

      const quantity = (totalEquity() * ENTRY_RATIO) / close;
      if (quantity * close < 1) continue;
      cash -= quantity * close * MAKER_FEE;
      positions.set(rule.symbol, {
        direction,
        quantity,
        avgPrice: close,
        firstPrice: close,
        firstQuantity: quantity,
        openedAt: closeTime,
        added: false,
      });
      record(
        closeTime,
        rule.symbol,
        direction > 0 ? "buy" : "short",
        quantity,
        close,
        `4시간 범위 ${direction > 0 ? "아래" : "위"} 1/3에서 ${direction > 0 ? "롱" : "숏"} 진입 (24시간 변동폭 ${(volatility * 100).toFixed(1)}% ≥ 기준 ${(threshold * 100).toFixed(1)}%)`,
      );
    }

    // 같은 날 기록은 마지막 값으로 덮어쓴다 (하루 끝 자산)
    const date = kstDate(closeTime - 1);
    if (equity.at(-1)?.date === date) equity.pop();
    equity.push({ ai: "wonyotti", date, cash, equity: totalEquity(), invested });
  }

  const holdings: HoldingRow[] = [...positions].map(([symbol, p]) => ({
    ai: "wonyotti",
    symbol,
    quantity: p.direction * p.quantity,
    avg_price: p.avgPrice,
    leverage: null,
    opened_at: new Date(p.openedAt).toISOString(),
    value: p.quantity * lastClose.get(symbol)!,
  }));
  if (core) {
    holdings.push({
      ai: "wonyotti",
      symbol: CORE_SYMBOL,
      quantity: core.quantity,
      avg_price: core.avgPrice,
      leverage: null,
      opened_at: new Date(core.openedAt).toISOString(),
      value: core.quantity * lastClose.get(CORE_SYMBOL)!,
    });
  }
  return { trades, holdings, equity };
}
