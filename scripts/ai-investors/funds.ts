// ETF로 운용하는 AI 3명: 월가, 한국개미, 공포탐욕
import { START, STOCK_FEE } from "./config.ts";
import { Ledger, depositDays } from "./ledger.ts";
import type { Market } from "./market.ts";

type Weights = Record<string, number>;

function holdingValue(ledger: Ledger, market: Market, symbol: string, day: string) {
  return ledger.quantity(symbol) * market.price(symbol, day)!;
}

// 현금 전부를 목표 비중대로 나눠 산다.
function buyByWeights(
  ledger: Ledger,
  market: Market,
  weights: Weights,
  day: string,
  reason: string,
) {
  const budget = ledger.cash / (1 + STOCK_FEE);
  if (budget <= 1) return;
  for (const [symbol, weight] of Object.entries(weights)) {
    ledger.trade(symbol, (budget * weight) / market.price(symbol, day)!, day, reason);
  }
}

// 현금으로 목표 비중보다 모자란 종목부터 채우고, 다 채우고 남으면 목표 비중대로 나눈다 (팔지 않고 맞추기).
function fillShortfalls(
  ledger: Ledger,
  market: Market,
  weights: Weights,
  day: string,
  reason: string,
) {
  const budget = ledger.cash / (1 + STOCK_FEE);
  if (budget <= 1) return;
  const equity = ledger.value(day);
  const shortfalls = Object.entries(weights).map(([symbol, weight]) => ({
    symbol,
    weight,
    short: Math.max(0, equity * weight - holdingValue(ledger, market, symbol, day)),
  }));
  const totalShort = shortfalls.reduce((sum, s) => sum + s.short, 0);
  for (const { symbol, weight, short } of shortfalls) {
    const amount =
      totalShort >= budget ? (budget * short) / totalShort : short + (budget - totalShort) * weight;
    if (amount > 1) ledger.trade(symbol, amount / market.price(symbol, day)!, day, reason);
  }
}

// 전체를 목표 비중으로 되돌린다. 판 돈으로 사야 하니 매도부터.
function rebalanceTo(
  ledger: Ledger,
  market: Market,
  weights: Weights,
  day: string,
  reason: string,
) {
  const equity = ledger.value(day);
  const changes = Object.entries(weights).map(([symbol, weight]) => {
    const price = market.price(symbol, day)!;
    return {
      symbol,
      change: (equity * weight) / (1 + STOCK_FEE) / price - ledger.quantity(symbol),
    };
  });
  for (const { symbol, change } of changes.filter((c) => c.change < 0)) {
    ledger.trade(symbol, change, day, reason);
  }
  for (const { symbol, change } of changes.filter((c) => c.change > 0)) {
    ledger.trade(symbol, change, day, reason);
  }
}

// AI 월가: VOO 30 · QQQ 30 · 단기 미국채(SGOV) 20 · 금(GLD) 10 · 비트코인(IBIT) 10.
// 매월 입금액으로 모자란 종목부터 채우고, 그래도 목표에서 5%p 넘게 벗어난 종목이 있으면 전체를 되돌린다.
const WALLSTREET_WEIGHTS: Weights = { VOO: 0.3, QQQ: 0.3, SGOV: 0.2, GLD: 0.1, IBIT: 0.1 };
const WALLSTREET_BAND = 0.05;

export function runWallstreet(market: Market, today: string) {
  const ledger = new Ledger("wallstreet", market);
  const days = market.tradingDays("VOO", START, today);
  const deposits = depositDays(days);
  days.forEach((day, i) => {
    if (i > 0) ledger.startDay(day, days[i - 1]); // 배당은 현금으로 쌓였다가 다음 입금 때 같이 들어간다
    if (deposits.has(day)) {
      ledger.deposit(day);
      fillShortfalls(ledger, market, WALLSTREET_WEIGHTS, day, "매월 적립 (모자란 비중부터)");
      const equity = ledger.value(day);
      const drifted = Object.entries(WALLSTREET_WEIGHTS).some(
        ([symbol, weight]) =>
          Math.abs(holdingValue(ledger, market, symbol, day) / equity - weight) > WALLSTREET_BAND,
      );
      if (drifted) rebalanceTo(ledger, market, WALLSTREET_WEIGHTS, day, "비중 5%p 이탈 리밸런싱");
    }
    ledger.record(day);
  });
  return ledger;
}

// AI 한국개미: KODEX 200 50 · 코스닥150 20 · 국고채3년 15 · 금현물 10 · 비트코인 5 (원화).
// 매월 입금액을 목표 비중대로 사고, 12월 마지막 거래일에 전량 매도 → 1월 10일 입금일에 전부 다시 산다.
// 국내엔 비트코인 현물 ETF가 없어서 비트코인은 원화로 직접 보유한 것으로 계산한다.
const KOREAN_ANT_WEIGHTS: Weights = {
  "069500.KS": 0.5,
  "229200.KS": 0.2,
  "114260.KS": 0.15,
  "411060.KS": 0.1,
  "BTC-KRW": 0.05,
};

export function runKoreanAnt(market: Market, today: string) {
  const ledger = new Ledger("korean_ant", market, "KRW");
  const days = market.tradingDays("069500.KS", START, today);
  const deposits = depositDays(days);
  days.forEach((day, i) => {
    if (i > 0) {
      for (const [symbol, amount] of ledger.startDay(day, days[i - 1])) {
        ledger.trade(
          symbol,
          amount / (1 + STOCK_FEE) / market.price(symbol, day)!,
          day,
          "배당 재투자",
        );
      }
    }
    if (deposits.has(day)) {
      ledger.deposit(day);
      const reason = day.slice(5, 7) === "01" ? "연초 재매수 (목표 비중)" : "매월 적립 (목표 비중)";
      buyByWeights(ledger, market, KOREAN_ANT_WEIGHTS, day, reason);
    }
    // 다음 거래일이 해가 바뀌면 오늘이 그해 마지막 거래일
    const next = days[i + 1];
    if (next && next.slice(0, 4) !== day.slice(0, 4)) {
      for (const [symbol, holding] of [...ledger.holdings]) {
        ledger.trade(symbol, -holding.quantity, day, "연말 전량 매도");
      }
    }
    ledger.record(day);
  });
  return ledger;
}

// AI 공포탐욕: 입금은 현금(단기국채 이자)으로 쌓고, 공포 단계에서 VOO 분할매수, 환희에서 분할매도.
const FEAR_STAGES = [
  { stage: 1, ratio: 0.3, hit: (drawdown: number, vix: number) => drawdown <= -0.1 || vix >= 30 },
  { stage: 2, ratio: 0.5, hit: (drawdown: number, vix: number) => drawdown <= -0.2 || vix >= 40 },
  { stage: 3, ratio: 1.0, hit: (drawdown: number) => drawdown <= -0.3 },
];

export function runFearGreed(market: Market, today: string) {
  const ledger = new Ledger("fear_greed", market);
  const days = market.tradingDays("VOO", START, today);
  const deposits = depositDays(days);
  const fired = new Set<number>(); // 이번 하락장에서 이미 쓴 단계
  let soldRatio = 0;
  let lastSellIndex = -Infinity;

  days.forEach((day, i) => {
    if (i > 0) ledger.startDay(day, days[i - 1]); // 배당은 현금으로 쌓는다
    if (deposits.has(day)) ledger.deposit(day);

    const sp500 = market.price("^GSPC", day)!;
    const allTimeHigh = Math.max(...market.closesBetween("^GSPC", "1900-01-01", day));
    const drawdown = sp500 / allTimeHigh - 1;
    const vix = market.price("^VIX", day)!;
    if (drawdown >= 0) fired.clear(); // 사상 최고가를 되찾으면 단계 초기화

    for (const { stage, ratio, hit } of FEAR_STAGES) {
      if (fired.has(stage) || !hit(drawdown, vix) || ledger.cash <= 0) continue;
      fired.add(stage);
      const amount = (ledger.cash * ratio) / (1 + STOCK_FEE);
      ledger.trade(
        "VOO",
        amount / market.price("VOO", day)!,
        day,
        `공포 ${stage}단계 매수 (고점 대비 ${(drawdown * 100).toFixed(1)}%, VIX ${vix.toFixed(1)})`,
      );
    }

    const recent = market.closesBetween("^GSPC", "1900-01-01", day).slice(-200);
    const movingAverage = recent.reduce((sum, close) => sum + close, 0) / recent.length;
    const euphoric = drawdown >= -0.02 && vix <= 13 && sp500 >= movingAverage * 1.15;
    const held = ledger.quantity("VOO");
    if (euphoric && held > 0 && soldRatio < 0.5 && i - lastSellIndex >= 20) {
      ledger.trade(
        "VOO",
        -held * 0.2,
        day,
        `환희 매도 20% (VIX ${vix.toFixed(1)}, 200일선 +${((sp500 / movingAverage - 1) * 100).toFixed(1)}%)`,
      );
      soldRatio += 0.2;
      lastSellIndex = i;
    }
    ledger.record(day);
  });
  return ledger;
}
