// AI 버리. 기준별 출처는 TODO.md 19번 참고. 실제 버리는 풋옵션을 썼지만 무료 옵션 과거 데이터가 없어 공매도로 대체.
import { START } from "./config.ts";
import {
  CASH,
  DEPRECIATION,
  LONG_TERM_DEBT,
  OPERATING_INCOME,
  REVENUE,
  freeCashFlow,
  instant,
  marketCap,
  ttm,
} from "./fundamentals.ts";
import { Ledger, depositDays } from "./ledger.ts";
import { addDays } from "./market.ts";
import type { Market, UniverseRow } from "./market.ts";

const LONG_WEIGHT = 0.15;
const SHORT_WEIGHT = -0.1;
const GOLD_WEIGHT = 0.1;
const SHORT_STOP = 1.5; // 숏 가격이 평균단가의 1.5배가 되면 손절

// [본인] "EV/EBITDA로 대량 스크리닝" + "부채는 최소를 선호"
function evToEbitda(market: Market, row: UniverseRow, day: string) {
  const operating = ttm(market, row.cik, OPERATING_INCOME, day);
  const depreciation = ttm(market, row.cik, DEPRECIATION, day);
  const cap = marketCap(market, row.symbol, row.cik, day);
  if (operating === null || depreciation === null || !cap || operating + depreciation <= 0)
    return null;
  const ebitda = operating + depreciation;
  const netDebt =
    (instant(market, row.cik, LONG_TERM_DEBT, day) ?? 0) -
    (instant(market, row.cik, CASH, day) ?? 0);
  return { multiple: (cap + netDebt) / ebitda, netDebtToEbitda: netDebt / ebitda };
}

function pickTargets(market: Market, day: string) {
  const members = market.universe.filter((row) => market.isMember(row, day));

  // [본인] "로드킬처럼 보일 때 사서 좀 닦이면 판다" → [우리] 52주 고점 대비 -40% 이하
  const longs: { symbol: string; multiple: number }[] = [];
  for (const row of members) {
    if (row.sector === "Financials" || row.sector === "Real Estate") continue;
    const price = market.price(row.symbol, day);
    const high = Math.max(...market.closesBetween(row.symbol, addDays(day, -365), day));
    if (!price || price > high * 0.6) continue;
    const cash = freeCashFlow(market, row.cik, day);
    const value = evToEbitda(market, row, day);
    // [본인] 진짜 잉여현금흐름 흑자 / [우리] 순부채 ≤ EBITDA 1배
    if (!cash || cash <= 0 || !value || value.multiple <= 0 || value.netDebtToEbitda > 1) continue;
    longs.push({ symbol: row.symbol, multiple: value.multiple });
  }
  longs.sort((a, b) => a.multiple - b.multiple);

  // [우리] 대형주 100위 안에서 매출 대비 20배 넘게 비싸고 6개월간 가장 많이 오른 3개 (버블 판단의 대용)
  const largest = members
    .map((row) => ({ row, cap: marketCap(market, row.symbol, row.cik, day) }))
    .filter((c): c is { row: UniverseRow; cap: number } => c.cap !== null)
    .sort((a, b) => b.cap - a.cap)
    .slice(0, 100);
  const shorts: { symbol: string; rise: number; priceToSales: number }[] = [];
  for (const { row, cap } of largest) {
    // REIT는 임대료 매출이 REVENUE 항목에 안 잡혀 P/S가 100배 넘게 나온다 (AMT·CCI·PLD, 2026-10-11 백테스트에서 발견)
    if (row.sector === "Real Estate") continue;
    const revenue = ttm(market, row.cik, REVENUE, day);
    const before = market.price(row.symbol, addDays(day, -182));
    if (!revenue || revenue <= 0 || !before || cap / revenue < 20) continue;
    shorts.push({
      symbol: row.symbol,
      rise: market.price(row.symbol, day)! / before - 1,
      priceToSales: cap / revenue,
    });
  }
  shorts.sort((a, b) => b.rise - a.rise);

  return { longs: longs.slice(0, 5), shorts: shorts.slice(0, 3) };
}

export function runBurry(market: Market, today: string) {
  const ledger = new Ledger("burry", market);
  const days = market.tradingDays("VOO", START, today);
  const deposits = depositDays(days);

  days.forEach((day, i) => {
    if (i > 0) ledger.startDay(day, days[i - 1]);
    for (const [symbol, holding] of [...ledger.holdings]) {
      if (holding.quantity < 0 && market.price(symbol, day)! >= holding.avgPrice * SHORT_STOP) {
        ledger.trade(symbol, -holding.quantity, day, `숏 손절 (평균단가의 ${SHORT_STOP}배 도달)`);
      }
    }

    if (deposits.has(day)) {
      ledger.deposit(day);
      const { longs, shorts } = pickTargets(market, day);
      const equity = ledger.value(day);
      const targets = new Map<string, { weight: number; reason: string }>();
      for (const long of longs) {
        targets.set(long.symbol, {
          weight: LONG_WEIGHT,
          reason: `롱 (EV/EBITDA ${long.multiple.toFixed(1)}배, 52주 고점 대비 -40% 이하)`,
        });
      }
      for (const short of shorts) {
        targets.set(short.symbol, {
          weight: SHORT_WEIGHT,
          reason: `숏 (매출 대비 ${short.priceToSales.toFixed(0)}배, 6개월 +${(short.rise * 100).toFixed(0)}%)`,
        });
      }
      // [본인] 2010 인터뷰 "농지·금, 달러 약세 대비"
      targets.set("GLD", { weight: GOLD_WEIGHT, reason: "금 10%" });

      for (const [symbol, holding] of [...ledger.holdings]) {
        if (!targets.has(symbol))
          ledger.trade(symbol, -holding.quantity, day, "목표에서 빠져 정리");
      }
      for (const [symbol, { weight, reason }] of targets) {
        const price = market.price(symbol, day)!;
        const change = (equity * weight) / price - ledger.quantity(symbol);
        if (Math.abs(change * price) > 1) ledger.trade(symbol, change, day, reason);
      }
    }
    ledger.record(day);
  });
  return ledger;
}
