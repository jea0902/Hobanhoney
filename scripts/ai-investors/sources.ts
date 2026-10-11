// 외부 데이터 출처. 전부 키 없이 쓰는 공개 API다.
import { setTimeout as sleep } from "node:timers/promises";
import { FUNDAMENTALS_FILED_FROM } from "./config.ts";

export interface PriceRow {
  symbol: string;
  date: string;
  close: number;
  dividend: number;
}

export interface SplitRow {
  symbol: string;
  date: string;
  ratio: number;
}

export interface FactRow {
  cik: string;
  tag: string;
  period_start: string | null;
  period_end: string;
  value: number;
  filed: string;
  form: string;
}

// ---- 야후 파이낸스 (비공식 차트 API, src/lib/yahooFinance.ts와 같은 엔드포인트) ----

// 거래소 현지 날짜로 바꾼다 (한국 ETF는 KST, 미국은 ET).
function toLocalDate(timestamp: number, gmtOffset: number) {
  return new Date((timestamp + gmtOffset) * 1000).toISOString().slice(0, 10);
}

export async function fetchYahoo(symbol: string, from: string) {
  const period1 = Math.floor(Date.parse(from) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const result = (await res.json())?.chart?.result?.[0];
  if (!result?.timestamp) return null;

  const offset: number = result.meta?.gmtoffset ?? 0;
  const dividends = new Map<string, number>();
  for (const event of Object.values(result.events?.dividends ?? {}) as {
    date: number;
    amount: number;
  }[]) {
    dividends.set(toLocalDate(event.date, offset), event.amount);
  }

  // 같은 날짜가 두 번 오는 경우(장중 마지막 행)가 있어서 날짜별로 마지막 값만 남긴다.
  const byDate = new Map<string, PriceRow>();
  const closes: (number | null)[] = result.indicators.quote[0].close;
  result.timestamp.forEach((timestamp: number, i: number) => {
    const close = closes[i];
    if (close === null) return;
    const date = toLocalDate(timestamp, offset);
    byDate.set(date, { symbol, date, close, dividend: dividends.get(date) ?? 0 });
  });

  const splits: SplitRow[] = (
    Object.values(result.events?.splits ?? {}) as {
      date: number;
      numerator: number;
      denominator: number;
    }[]
  ).map((event) => ({
    symbol,
    date: toLocalDate(event.date, offset),
    ratio: event.numerator / event.denominator,
  }));

  return { prices: [...byDate.values()], splits };
}

// ---- SEC EDGAR ----

function secHeaders() {
  // SEC는 User-Agent에 연락처를 요구한다 (없으면 차단).
  return { "User-Agent": `Hobanhoney research ${process.env.SEC_CONTACT_EMAIL}` };
}

// 티커 → CIK. 위키백과 CIK는 틀린 경우가 있어서(NOC) 이 공식 목록을 우선한다.
export async function fetchSecTickers() {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: secHeaders(),
  });
  const json = (await res.json()) as Record<string, { ticker: string; cik_str: number }>;
  return new Map(
    Object.values(json).map((row) => [row.ticker, String(row.cik_str).padStart(10, "0")]),
  );
}

// [항목, 단위]. 회사마다 쓰는 항목 이름이 달라서 같은 뜻의 후보를 여러 개 받는다.
const FACT_TAGS: [string, string][] = [
  ["NetIncomeLoss", "USD"],
  ["StockholdersEquity", "USD"],
  ["NetCashProvidedByUsedInOperatingActivities", "USD"],
  ["PaymentsToAcquirePropertyPlantAndEquipment", "USD"],
  ["LongTermDebtNoncurrent", "USD"],
  ["LongTermDebt", "USD"],
  ["Revenues", "USD"],
  ["RevenueFromContractWithCustomerExcludingAssessedTax", "USD"],
  ["SalesRevenueNet", "USD"],
  ["OperatingIncomeLoss", "USD"],
  ["DepreciationDepletionAndAmortization", "USD"],
  ["DepreciationAndAmortization", "USD"],
  ["DepreciationAmortizationAndAccretionNet", "USD"],
  ["CashAndCashEquivalentsAtCarryingValue", "USD"],
  ["WeightedAverageNumberOfDilutedSharesOutstanding", "shares"],
  ["CommonStockSharesOutstanding", "shares"],
  ["EarningsPerShareDiluted", "USD/shares"],
];
export const COVER_SHARES_TAG = "dei:EntityCommonStockSharesOutstanding";

interface SecFact {
  start?: string;
  end: string;
  val: number;
  filed: string;
  form: string;
}

export async function fetchCompanyFacts(cik: string): Promise<FactRow[] | null> {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: secHeaders(),
  });
  if (!res.ok) return null;
  const facts = (await res.json()).facts ?? {};

  const sources: [string, SecFact[]][] = FACT_TAGS.map(([tag, unit]) => [
    tag,
    facts["us-gaap"]?.[tag]?.units?.[unit] ?? [],
  ]);
  sources.push([
    COVER_SHARES_TAG,
    facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [],
  ]);

  // 10-K·10-Q엔 전년 비교 수치가 매번 다시 실린다. 같은 값은 처음 공시된 것 하나만 남긴다.
  const earliest = new Map<string, FactRow>();
  for (const [tag, rows] of sources) {
    for (const row of rows) {
      if (row.form !== "10-K" && row.form !== "10-Q") continue;
      const key = `${tag}|${row.start ?? ""}|${row.end}|${row.val}`;
      const seen = earliest.get(key);
      if (seen && seen.filed <= row.filed) continue;
      earliest.set(key, {
        cik,
        tag,
        period_start: row.start ?? null,
        period_end: row.end,
        value: row.val,
        filed: row.filed,
        form: row.form,
      });
    }
  }
  return [...earliest.values()].filter((row) => row.filed >= FUNDAMENTALS_FILED_FROM);
}

// ---- 위키백과 (S&P500 구성 종목) ----

async function fetchWikitext(page: string, section?: number) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}` +
    `&prop=wikitext&format=json${section === undefined ? "" : `&section=${section}`}`;
  const res = await fetch(url, { headers: { "User-Agent": "Hobanhoney research" } });
  return (await res.json()).parse.wikitext["*"] as string;
}

// 행 예: "|| {{NyseSymbol|MMM}}\n|| [[3M]]\n|| Industrials \n|| ... \n|| 0000066740\n|| 1902"
export async function fetchSp500() {
  const text = await fetchWikitext("List_of_S&P_500_companies", 1);
  const companies: { symbol: string; sector: string; cik: string }[] = [];
  for (const row of text.split("\n|-").slice(1)) {
    const cells = row
      .split(/\n\|\|?/)
      .map((cell) => cell.trim())
      .filter(Boolean);
    const ticker = cells[0]?.match(/\{\{[^|}]+\|([^}|]+)\}\}/)?.[1];
    const cik = row.match(/\b\d{10}\b/)?.[0];
    if (!ticker || !cik || cells.length < 7) continue;
    companies.push({ symbol: ticker.trim().replace(".", "-"), sector: cells[2], cik });
  }
  return companies;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseWikiDate(text: string) {
  const match = text.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]) + 1;
  if (month === 0) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

// "Historical components of the S&P 500" 변경 표. 최신순이라 since보다 오래된 행이 나오면 멈춘다.
export async function fetchSp500Changes(since: string) {
  const text = await fetchWikitext("Historical_components_of_the_S&P_500");
  const tableStart = text.indexOf("{|");
  const table = text.slice(tableStart, text.indexOf("\n|}", tableStart));
  const changes: { date: string; added: string; removed: string }[] = [];
  for (const row of table.split("\n|-").slice(2)) {
    const cells = row
      .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, "")
      .split(/\n\|\|?|\|\|/)
      .slice(1)
      .map((cell) => cell.trim());
    const date = parseWikiDate(cells[0] ?? "");
    if (!date) continue;
    if (date < since) break;
    changes.push({
      date,
      added: (cells[1] ?? "").replace(".", "-"),
      removed: (cells[3] ?? "").replace(".", "-"),
    });
  }
  return changes;
}

// ---- Bybit 캔들 (AI 호반꿀 강제청산 판정용 1분봉, AI 워뇨띠 1시간봉) ----

export interface Candle {
  time: number; // 봉 시작 시각 (ms)
  high: number;
  low: number;
  close: number;
  volume: number; // AI 워뇨띠 거래량 조건용
}

// GitHub Actions에서 Bybit을 직접 부르면 전부 실패해서(2026-10-11) 우리 사이트(/api/bybit-kline)를 거친다.
async function fetchKlinePage(symbol: string, start: number, end: number, minutes: number) {
  const url =
    `${process.env.SITE_URL}/api/bybit-kline?symbol=${symbol}&start=${start}&end=${end}` +
    `&interval=${minutes}`;
  let failure = "";
  // 연달아 부르면 가끔 일시적으로 거절돼서(2026-10-11 ZEC·SPCX) 세 번까지 다시 시도한다.
  for (let attempt = 0; attempt < 3; attempt++) {
    failure = "";
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const text = await res.text();
      failure = `${res.status} ${text.slice(0, 200)}`;
      const json = JSON.parse(text);
      if (json.retCode === 0) return json.result.list as string[][];
    } catch (error) {
      failure = `${failure} ${error}`.trim();
    }
    await sleep(1000 * (attempt + 1));
  }
  // 원인을 알 수 있게 마지막 실패 응답을 남긴다 (GitHub Actions 로그에 보임).
  console.log(`[bybit-kline] ${symbol} ${start} 실패: ${failure}`);
  return null;
}

// Bybit는 한 번에 최대 1000개라 1000봉씩 나눠 받는다. 종목이 없으면 null. minutes는 봉 간격(1 = 1분봉, 60 = 1시간봉).
export async function fetchCandles(
  symbol: string,
  fromMs: number,
  toMs: number,
  minutes = 1,
): Promise<Candle[] | null> {
  const step = minutes * 60_000;
  const candles: Candle[] = [];
  for (let start = fromMs; start <= toMs; start += 1000 * step) {
    const end = Math.min(start + 999 * step, toMs);
    const list = await fetchKlinePage(symbol, start, end, minutes);
    if (!list) return null;
    for (const [time, , high, low, close, volume] of list) {
      candles.push({
        time: Number(time),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      });
    }
    await sleep(100);
  }
  return candles.sort((a, b) => a.time - b.time);
}
