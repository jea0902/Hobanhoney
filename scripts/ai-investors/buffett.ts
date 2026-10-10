// AI 버핏. 기준별 출처는 TODO.md 19번 참고 ([본인] 버핏이 한 말 / [우리] 그 개념을 숫자로 옮긴 가정).
import { START, STOCK_FEE } from "./config.ts";
import {
  EQUITY,
  LONG_TERM_DEBT,
  NET_INCOME,
  annual,
  freeCashFlow,
  instant,
  marketCap,
} from "./fundamentals.ts";
import { Ledger, depositDays } from "./ledger.ts";
import type { Market, UniverseRow } from "./market.ts";

const MAX_STOCKS = 10;
const QUALITY_CHECK_MONTHS = ["03", "06", "09", "12"];

function isQuality(market: Market, row: UniverseRow, day: string) {
  // [우리] 은행은 부채 구조상 ROE·부채 기준이 맞지 않아 뺀다 (버핏 본인은 은행·보험을 좋아함).
  if (row.sector === "Financials") return false;
  const netIncome = annual(market, row.cik, NET_INCOME, day).slice(-10);
  if (netIncome.length < 10) return false;
  const roes: number[] = [];
  for (const year of netIncome) {
    const equity = instant(market, row.cik, EQUITY, day, year.period_end);
    if (!equity || equity <= 0) return false;
    roes.push(year.value / equity);
  }
  // [본인] 1987 주주서한의 "경제적 탁월함": 10년 평균 ROE 20% 초과, 한 해도 15% 미만 없음
  const averageRoe = roes.reduce((sum, roe) => sum + roe, 0) / roes.length;
  // [본인] "부채가 거의 없이" → [우리] 장기부채 ≤ 순이익 4년치
  const debt = instant(market, row.cik, LONG_TERM_DEBT, day) ?? 0;
  return averageRoe > 0.2 && Math.min(...roes) >= 0.15 && debt <= 4 * netIncome.at(-1)!.value;
}

// [본인] 오너 어닝스를 장기 국채 금리로 할인 → 잉여현금흐름 ÷ 시총이 30년물 금리 이상이면 싸다고 본다.
function cashYield(market: Market, row: UniverseRow, day: string) {
  const cash = freeCashFlow(market, row.cik, day);
  const cap = marketCap(market, row.symbol, row.cik, day);
  return cash !== null && cap ? cash / cap : null;
}

export function runBuffett(market: Market, today: string) {
  const ledger = new Ledger("buffett", market);
  const days = market.tradingDays("VOO", START, today);
  const deposits = depositDays(days);

  days.forEach((day, i) => {
    if (i > 0) ledger.startDay(day, days[i - 1]);
    if (deposits.has(day)) {
      ledger.deposit(day);
      const held = new Set(ledger.holdings.keys());
      const quality = market.universe.filter(
        (row) => (market.isMember(row, day) || held.has(row.symbol)) && isQuality(market, row, day),
      );
      const qualitySymbols = new Set(quality.map((row) => row.symbol));

      // [본인] "훌륭한 기업이면 가장 좋아하는 보유 기간은 영원" → 가격이 아니라 품질이 망가졌을 때만 판다.
      if (QUALITY_CHECK_MONTHS.includes(day.slice(5, 7))) {
        for (const [symbol, holding] of [...ledger.holdings]) {
          if (!qualitySymbols.has(symbol))
            ledger.trade(symbol, -holding.quantity, day, "품질 기준 탈락 매도");
        }
      }

      const treasury30y = market.price("^TYX", day)! / 100;
      const cheap = quality
        .filter((row) => market.isMember(row, day))
        .map((row) => ({ symbol: row.symbol, yield: cashYield(market, row, day) }))
        .filter(
          (c): c is { symbol: string; yield: number } => c.yield !== null && c.yield >= treasury30y,
        )
        .sort((a, b) => b.yield - a.yield);

      const owned = [...ledger.holdings.keys()];
      const newPicks = cheap
        .filter((c) => !ledger.holdings.has(c.symbol))
        .slice(0, MAX_STOCKS - owned.length);
      const equity = ledger.value(day);
      for (const symbol of [...owned, ...newPicks.map((c) => c.symbol)]) {
        const pick = cheap.find((c) => c.symbol === symbol);
        if (!pick) continue; // 지금 비싸면 더 사지 않고 보유만 한다
        const price = market.price(symbol, day)!;
        const gap = equity / MAX_STOCKS - ledger.quantity(symbol) * price;
        const amount = Math.min(gap, ledger.cash / (1 + STOCK_FEE));
        if (amount > 1) {
          ledger.trade(
            symbol,
            amount / price,
            day,
            `매수 (잉여현금흐름 수익률 ${(pick.yield * 100).toFixed(1)}% ≥ 30년물 ${(treasury30y * 100).toFixed(2)}%)`,
          );
        }
      }
    }
    ledger.record(day);
  });
  return ledger;
}
