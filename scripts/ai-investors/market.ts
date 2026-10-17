// DB에 쌓인 원본 데이터를 읽고, 출처에서 새로 받은 만큼 DB에 더한 뒤, 계산에 쓸 형태로 묶는다.
import { setTimeout as sleep } from "node:timers/promises";
import {
  KNOWN_CIKS,
  PRICE_HISTORY_FROM,
  SP500_HISTORY_FROM,
  START,
  UNAVAILABLE_REMOVED,
} from "./config.ts";
import { insertRows, logEvent, readAll, upsertRows } from "./db.ts";
import {
  fetchCompanyFacts,
  fetchSecTickers,
  fetchSp500,
  fetchSp500Changes,
  fetchYahoo,
} from "./sources.ts";
import type { FactRow, PriceRow, SplitRow } from "./sources.ts";

// ETF·지수·금리·환율. 개별 종목은 ai_universe에서 정해진다.
export const FUND_SYMBOLS = [
  "VOO",
  "QQQ",
  "SPY", // AI 포트
  "IEF", // AI 포트
  "BTC-USD", // AI 포트 (비트코인 현물)
  "SGOV",
  "GLD",
  "IBIT",
  "069500.KS",
  "229200.KS",
  "114260.KS",
  "411060.KS",
  "BTC-KRW",
  "^GSPC",
  "^VIX",
  "^IRX",
  "^TYX",
  "KRW=X",
];

export interface UniverseRow {
  symbol: string;
  cik: string;
  sector: string;
  added_on: string | null;
  removed_on: string | null;
}

interface Series {
  dates: string[];
  closes: number[];
  dividends: Map<string, number>;
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export class Market {
  series = new Map<string, Series>();
  splits = new Map<string, SplitRow[]>();
  universe: UniverseRow[] = [];
  facts = new Map<string, Map<string, FactRow[]>>(); // cik → 항목 → 행

  // date 이전(포함) 마지막 종가. 그날 휴장이면 직전 거래일 값.
  price(symbol: string, date: string): number | null {
    const series = this.series.get(symbol);
    if (!series) return null;
    let low = 0;
    let high = series.dates.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (series.dates[mid] <= date) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found === -1 ? null : series.closes[found];
  }

  dividend(symbol: string, date: string) {
    return this.series.get(symbol)?.dividends.get(date) ?? 0;
  }

  lastDate(symbol: string) {
    return this.series.get(symbol)?.dates.at(-1) ?? null;
  }

  tradingDays(symbol: string, from: string, to: string) {
    return (this.series.get(symbol)?.dates ?? []).filter((date) => date >= from && date <= to);
  }

  closesBetween(symbol: string, from: string, to: string) {
    const series = this.series.get(symbol);
    if (!series) return [];
    return series.closes.filter((_, i) => series.dates[i] >= from && series.dates[i] <= to);
  }

  isMember(row: UniverseRow, date: string) {
    return (
      (row.added_on === null || date >= row.added_on) &&
      (row.removed_on === null || date < row.removed_on)
    );
  }
}

interface Raw {
  prices: Map<string, Map<string, { close: number; dividend: number }>>;
  splits: Map<string, SplitRow[]>;
  universe: UniverseRow[];
  facts: FactRow[];
}

async function loadRaw(): Promise<Raw> {
  const priceRows = await readAll<PriceRow>("ai_prices", "symbol, date, close, dividend", [
    "symbol",
    "date",
  ]);
  const prices = new Map<string, Map<string, { close: number; dividend: number }>>();
  for (const row of priceRows) {
    if (!prices.has(row.symbol)) prices.set(row.symbol, new Map());
    prices
      .get(row.symbol)!
      .set(row.date, { close: Number(row.close), dividend: Number(row.dividend) });
  }

  const splitRows = await readAll<SplitRow>("ai_splits", "symbol, date, ratio", ["symbol", "date"]);
  const splits = new Map<string, SplitRow[]>();
  for (const row of splitRows) {
    splits.set(row.symbol, [
      ...(splits.get(row.symbol) ?? []),
      { ...row, ratio: Number(row.ratio) },
    ]);
  }

  const universe = await readAll<UniverseRow>(
    "ai_universe",
    "symbol, cik, sector, added_on, removed_on",
    ["symbol"],
  );
  const facts = await readAll<FactRow>(
    "ai_fundamentals",
    "cik, tag, period_start, period_end, value, filed, form",
    ["id"],
  );
  return {
    prices,
    splits,
    universe,
    facts: facts.map((row) => ({ ...row, value: Number(row.value) })),
  };
}

async function refreshUniverse(raw: Raw) {
  const [current, changes, secTickers] = await Promise.all([
    fetchSp500(),
    fetchSp500Changes(START),
    fetchSecTickers(),
  ]);
  const stored = new Map(raw.universe.map((row) => [row.symbol, row]));
  const addedOn = new Map(changes.filter((c) => c.added).map((c) => [c.added, c.date]));
  const removedOn = new Map(changes.filter((c) => c.removed).map((c) => [c.removed, c.date]));

  const rows = new Map<string, UniverseRow>();
  for (const company of current) {
    rows.set(company.symbol, {
      symbol: company.symbol,
      // 위키백과 CIK가 틀린 경우가 있어서(NOC) SEC 공식 목록을 우선한다.
      cik: secTickers.get(company.symbol) ?? company.cik,
      sector: company.sector,
      added_on: addedOn.get(company.symbol) ?? null,
      removed_on: null,
    });
  }
  for (const [symbol, date] of removedOn) {
    if (rows.has(symbol) || UNAVAILABLE_REMOVED.includes(symbol)) continue;
    const cik = stored.get(symbol)?.cik ?? secTickers.get(symbol) ?? KNOWN_CIKS[symbol];
    if (!cik) {
      await logEvent(
        "error",
        "편출 종목의 CIK를 못 찾아 제외 (config.ts KNOWN_CIKS에 추가 필요)",
        symbol,
      );
      continue;
    }
    rows.set(symbol, {
      symbol,
      cik,
      // 편출 전에 기록해둔 업종을 이어 쓴다.
      sector: stored.get(symbol)?.sector ?? "",
      added_on: addedOn.get(symbol) ?? null,
      removed_on: date,
    });
  }
  // 이번에 위키백과에서 안 보이는 예전 기록은 그대로 둔다.
  for (const row of stored.values()) {
    if (!rows.has(row.symbol)) rows.set(row.symbol, row);
  }

  raw.universe = [...rows.values()];
  await upsertRows("ai_universe", raw.universe, "symbol");
}

async function refreshPrices(raw: Raw) {
  const symbols = [...FUND_SYMBOLS, ...raw.universe.map((row) => row.symbol)];
  const newPrices: PriceRow[] = [];
  const newSplits: SplitRow[] = [];
  const failed: string[] = [];

  for (const symbol of symbols) {
    const stored = raw.prices.get(symbol);
    const lastStored = stored ? [...stored.keys()].sort().at(-1)! : null;
    // 최근 며칠은 야후가 값을 고치는 경우가 있어서 겹쳐서 다시 받는다.
    const from = lastStored
      ? addDays(lastStored, -7)
      : symbol === "^GSPC"
        ? SP500_HISTORY_FROM
        : PRICE_HISTORY_FROM;
    const fetched = await fetchYahoo(symbol, from).catch(() => null);
    await sleep(200);
    if (!fetched) {
      failed.push(symbol);
      continue;
    }
    if (!raw.prices.has(symbol)) raw.prices.set(symbol, new Map());
    for (const row of fetched.prices) {
      raw.prices.get(symbol)!.set(row.date, { close: row.close, dividend: row.dividend });
    }
    const knownSplits = raw.splits.get(symbol) ?? [];
    for (const split of fetched.splits) {
      if (!knownSplits.some((known) => known.date === split.date)) knownSplits.push(split);
    }
    raw.splits.set(symbol, knownSplits);
    newPrices.push(...fetched.prices);
    newSplits.push(...fetched.splits);
  }

  await upsertRows("ai_prices", newPrices, "symbol,date");
  await upsertRows("ai_splits", newSplits, "symbol,date");
  // 상장폐지 종목은 야후에서 더 안 나오는 게 정상이라, 쌓인 값조차 없는 종목만 오류로 남긴다.
  const missing = failed.filter((symbol) => !raw.prices.has(symbol));
  if (missing.length > 0)
    await logEvent("error", "야후 시세를 받지 못한 종목 (계산에서 제외)", missing.join(", "));
}

async function refreshFundamentals(raw: Raw) {
  const lastFiled = new Map<string, string>();
  for (const row of raw.facts) {
    if (row.filed > (lastFiled.get(row.cik) ?? "")) lastFiled.set(row.cik, row.filed);
  }

  const newFacts: FactRow[] = [];
  const failed: string[] = [];
  for (const cik of new Set(raw.universe.map((row) => row.cik))) {
    const fetched = await fetchCompanyFacts(cik).catch(() => null);
    // SEC 요청 한도(초당 10회) 아래로
    await sleep(120);
    if (!fetched) {
      failed.push(cik);
      continue;
    }
    // 이미 쌓인 공시 이후에 나온 것만 더한다.
    newFacts.push(...fetched.filter((row) => row.filed > (lastFiled.get(cik) ?? "")));
  }

  await insertRows("ai_fundamentals", newFacts);
  // 수십만 행이라 push(...배열)로 펼치면 호출 스택이 넘친다.
  for (const row of newFacts) raw.facts.push(row);
  if (failed.length > 0) await logEvent("error", "SEC 재무를 받지 못한 회사", failed.join(", "));
}

function buildMarket(raw: Raw) {
  const market = new Market();
  for (const [symbol, byDate] of raw.prices) {
    const dates = [...byDate.keys()].sort();
    const dividends = new Map<string, number>();
    for (const date of dates) {
      const dividend = byDate.get(date)!.dividend;
      if (dividend > 0) dividends.set(date, dividend);
    }
    market.series.set(symbol, {
      dates,
      closes: dates.map((date) => byDate.get(date)!.close),
      dividends,
    });
  }
  market.splits = raw.splits;
  market.universe = raw.universe;

  // 삽입이 중간에 끊겼다 다시 돌면 같은 행이 두 번 들어갈 수 있어서 여기서 한 번 더 거른다.
  const seen = new Set<string>();
  for (const row of raw.facts) {
    const key = `${row.cik}|${row.tag}|${row.period_start ?? ""}|${row.period_end}|${row.value}|${row.filed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!market.facts.has(row.cik)) market.facts.set(row.cik, new Map());
    const byTag = market.facts.get(row.cik)!;
    if (!byTag.has(row.tag)) byTag.set(row.tag, []);
    byTag.get(row.tag)!.push(row);
  }
  return market;
}

export async function loadAndRefreshMarket() {
  const raw = await loadRaw();
  console.log(`DB에서 읽음: 시세 ${raw.prices.size}종목, 재무 ${raw.facts.length}행`);
  await refreshUniverse(raw);
  console.log(`구성 종목 ${raw.universe.length}개 (편출 포함)`);
  await refreshPrices(raw);
  console.log("시세 갱신 완료");
  await refreshFundamentals(raw);
  console.log(`재무 갱신 완료 (총 ${raw.facts.length}행)`);
  return buildMarket(raw);
}
