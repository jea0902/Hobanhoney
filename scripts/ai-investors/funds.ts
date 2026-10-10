// ETF로 운용하는 AI 3명: 월가, 한국개미, 공포탐욕기계
import { START, STOCK_FEE } from "./config.ts";
import { Ledger, depositDays } from "./ledger.ts";
import type { Market } from "./market.ts";

// AI 월가: 입금 즉시 VOO 50% / QQQ 50%, 배당은 같은 ETF에 재투자. 팔지 않는다.
export function runWallstreet(market: Market, today: string) {
  const ledger = new Ledger("wallstreet", market);
  const days = market.tradingDays("VOO", START, today);
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
      const half = ledger.cash / 2 / (1 + STOCK_FEE);
      ledger.trade("VOO", half / market.price("VOO", day)!, day, "매월 적립");
      ledger.trade("QQQ", half / market.price("QQQ", day)!, day, "매월 적립");
    }
    ledger.record(day);
  });
  return ledger;
}

// AI 한국개미: 입금 즉시 원화로 KODEX 200, 배당 재투자. 기록은 달러로 바꿔서 (환율 손익 포함).
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
      ledger.trade(
        "069500.KS",
        ledger.cash / (1 + STOCK_FEE) / market.price("069500.KS", day)!,
        day,
        "매월 적립",
      );
    }
    ledger.record(day);
  });
  return ledger;
}

// AI 공포탐욕기계: 입금은 현금(단기국채 이자)으로 쌓고, 공포 단계에서 VOO 분할매수, 환희에서 분할매도.
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
