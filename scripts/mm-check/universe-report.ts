// 펌핑 신호 검증 A-2 (TODO 39번) 분석: universe-days.json(전 종목)으로 "어떤 상태의 코인이 30일 안에 펌핑을 시작하나"를 센다.
// 가설 둘을 같이 본다 — (가) 개인 롱 쏠림이 높은 코인 (나) 아무도 관심 없는 코인(거래대금·체결 건수·OI가 작거나 줄어든 코인)
// 실행: npm run mm-universe-report (먼저 npm run mm-universe로 데이터 모으기)
import { readFileSync } from "node:fs";

const DAY = 86_400_000;
const WINDOW_DAYS = 60; // 개인/큰손 롱숏 평균, 가격 변화를 보는 직전 기간
const AHEAD_DAYS = 30; // 이 안에 펌핑이 시작되면 "곧 펌핑"
const SKIP_AFTER_LISTING_DAYS = 14; // 상장 직후의 가격 형성은 펌핑으로 보지 않음 (mm-check와 같은 기준)
const MIN_RATIO_DAYS = 40; // 60일 중 롱숏 데이터가 이만큼은 있어야 계산

interface CoinDay {
  date: string;
  close: number;
  volume: number;
  trades: number;
  oiUsd?: number;
  allRatio?: number;
  topRatio?: number;
}

interface Row {
  coin: string;
  ratio: number; // 직전 60일 개인(전체 계정) 롱/숏 평균
  top: number; // 직전 60일 큰손(상위 트레이더 포지션) 롱/숏 평균
  priceChange: number; // 직전 60일 가격 변화
  volume: number; // 직전 30일 일 거래대금 중간값
  volumeTrend: number | null; // 직전 30일 거래대금 ÷ 그 전 90일 거래대금 (중간값끼리). 1보다 작으면 관심이 식는 중
  trades: number; // 직전 30일 하루 체결 건수 중간값
  oiUsd: number | null;
  pumpSoon: boolean;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function average(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const coins = JSON.parse(readFileSync("data/mm-check/universe-days.json", "utf8")) as {
  base: string;
  listed: number;
  days: CoinDay[];
}[];

const rows: Row[] = [];
let pumpStarts = 0;
for (const coin of coins) {
  const { days } = coin;
  const isPumpStart = days.map((d, i) => {
    if (Date.parse(d.date) < coin.listed + SKIP_AFTER_LISTING_DAYS * DAY) return false;
    const next = days.slice(i + 1, i + 8);
    return next.length === 7 && Math.max(...next.map((n) => n.close)) >= 2 * d.close;
  });
  pumpStarts += isPumpStart.filter(Boolean).length;

  for (let i = WINDOW_DAYS; i + AHEAD_DAYS + 7 < days.length; i++) {
    const window = days.slice(i - WINDOW_DAYS + 1, i + 1);
    const ratios = window.map((d) => d.allRatio).filter((v): v is number => v !== undefined);
    const tops = window.map((d) => d.topRatio).filter((v): v is number => v !== undefined);
    if (ratios.length < MIN_RATIO_DAYS || tops.length < MIN_RATIO_DAYS) continue;
    const recent = days.slice(i - 29, i + 1);
    const older = i >= 120 ? days.slice(i - 119, i - 29) : [];
    const volume = median(recent.map((d) => d.volume));
    rows.push({
      coin: coin.base,
      ratio: average(ratios),
      top: average(tops),
      priceChange: days[i].close / days[i - WINDOW_DAYS].close - 1,
      volume,
      volumeTrend: older.length > 0 ? volume / median(older.map((d) => d.volume)) : null,
      trades: median(recent.map((d) => d.trades)),
      oiUsd: days[i].oiUsd ?? null,
      pumpSoon: isPumpStart.slice(i + 1, i + 1 + AHEAD_DAYS).some(Boolean),
    });
  }
}

const rate = (group: Row[]) => group.filter((r) => r.pumpSoon).length / group.length;
const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
const base = rate(rows);

// 묶음마다: 30일 안 펌핑 시작 비율, 전체 평균 대비 배수, 날짜 수, 종목 수
function describe(group: Row[]) {
  if (group.length === 0) return "-";
  const coinCount = new Set(group.map((r) => r.coin)).size;
  return `${percent(rate(group))} (${(rate(group) / base).toFixed(1)}배, ${group.length}일, ${coinCount}종목)`;
}

interface Bucket {
  label: string;
  test: (r: Row) => boolean;
}

function table(title: string, buckets: Bucket[]) {
  console.log(`\n${title}`);
  for (const b of buckets) console.log(`  ${b.label.padEnd(16)} ${describe(rows.filter(b.test))}`);
}

function crossTable(title: string, outer: Bucket[], inner: Bucket[]) {
  console.log(`\n${title}`);
  console.log(`  ${"".padEnd(16)} ${inner.map((b) => b.label).join(" | ")}`);
  for (const o of outer) {
    const cells = inner.map((b) => {
      const group = rows.filter((r) => o.test(r) && b.test(r));
      return group.length < 100 ? `- (${group.length}일)` : `${percent(rate(group))} (${group.length}일)`;
    });
    console.log(`  ${o.label.padEnd(16)} ${cells.join(" | ")}`);
  }
}

const M = 1_000_000;
const ratioBuckets: Bucket[] = [
  { label: "개인 롱/숏 <1", test: (r) => r.ratio < 1 },
  { label: "1~1.5", test: (r) => r.ratio >= 1 && r.ratio < 1.5 },
  { label: "1.5~2", test: (r) => r.ratio >= 1.5 && r.ratio < 2 },
  { label: "2~3", test: (r) => r.ratio >= 2 && r.ratio < 3 },
  { label: "3 이상", test: (r) => r.ratio >= 3 },
];
const ratioBuckets3: Bucket[] = [
  { label: "개인 <1.5", test: (r) => r.ratio < 1.5 },
  { label: "1.5~2.5", test: (r) => r.ratio >= 1.5 && r.ratio < 2.5 },
  { label: "2.5 이상", test: (r) => r.ratio >= 2.5 },
];
const topBuckets: Bucket[] = [
  { label: "큰손 롱/숏 <0.8", test: (r) => r.top < 0.8 },
  { label: "0.8~1.2", test: (r) => r.top >= 0.8 && r.top < 1.2 },
  { label: "1.2~2", test: (r) => r.top >= 1.2 && r.top < 2 },
  { label: "2 이상", test: (r) => r.top >= 2 },
];
const volumeBuckets: Bucket[] = [
  { label: "거래대금 <$1M", test: (r) => r.volume < 1 * M },
  { label: "$1~5M", test: (r) => r.volume >= 1 * M && r.volume < 5 * M },
  { label: "$5~20M", test: (r) => r.volume >= 5 * M && r.volume < 20 * M },
  { label: "$20M 이상", test: (r) => r.volume >= 20 * M },
];
const trendBuckets: Bucket[] = [
  { label: "거래대금 <0.3배", test: (r) => r.volumeTrend !== null && r.volumeTrend < 0.3 },
  { label: "0.3~0.6배", test: (r) => r.volumeTrend !== null && r.volumeTrend >= 0.3 && r.volumeTrend < 0.6 },
  { label: "0.6~1배", test: (r) => r.volumeTrend !== null && r.volumeTrend >= 0.6 && r.volumeTrend < 1 },
  { label: "1배 이상", test: (r) => r.volumeTrend !== null && r.volumeTrend >= 1 },
];
const tradesBuckets: Bucket[] = [
  { label: "체결 <1만 건", test: (r) => r.trades < 10_000 },
  { label: "1~5만", test: (r) => r.trades >= 10_000 && r.trades < 50_000 },
  { label: "5~20만", test: (r) => r.trades >= 50_000 && r.trades < 200_000 },
  { label: "20만 이상", test: (r) => r.trades >= 200_000 },
];
const oiBuckets: Bucket[] = [
  { label: "OI <$2M", test: (r) => r.oiUsd !== null && r.oiUsd < 2 * M },
  { label: "$2~10M", test: (r) => r.oiUsd !== null && r.oiUsd >= 2 * M && r.oiUsd < 10 * M },
  { label: "$10~50M", test: (r) => r.oiUsd !== null && r.oiUsd >= 10 * M && r.oiUsd < 50 * M },
  { label: "$50M 이상", test: (r) => r.oiUsd !== null && r.oiUsd >= 50 * M },
];
const priceBuckets: Bucket[] = [
  { label: "60일 -40% 이하", test: (r) => r.priceChange <= -0.4 },
  { label: "60일 -40~0%", test: (r) => r.priceChange > -0.4 && r.priceChange <= 0 },
  { label: "60일 0% 초과", test: (r) => r.priceChange > 0 },
];

console.log(
  `전 종목 ${coins.length}개, 계산한 날짜 ${rows.length}개, 펌핑 시작일(7일 안 종가 2배) ${pumpStarts}개`,
);
console.log(`전체 평균: 아무 날이나 30일 안에 펌핑이 시작된 비율 ${percent(base)}`);

table("(가) 직전 60일 개인 롱/숏 평균별", ratioBuckets);
table("    직전 60일 큰손 롱/숏 평균별", topBuckets);
table("(나) 직전 30일 일 거래대금(중간값)별", volumeBuckets);
table("    거래대금 변화 (최근 30일 ÷ 그 전 90일)별", trendBuckets);
table("    하루 체결 건수(최근 30일 중간값)별", tradesBuckets);
table("    OI 금액별", oiBuckets);
table("    직전 60일 가격 변화별", priceBuckets);
crossTable("(가)×(나) 거래대금 × 개인 롱/숏", volumeBuckets, ratioBuckets3);
crossTable("(가)×(나) 거래대금 변화 × 개인 롱/숏", trendBuckets, ratioBuckets3);
crossTable("가격 변화 × 개인 롱/숏", priceBuckets, ratioBuckets3);
crossTable("가격 변화 × 거래대금", priceBuckets, volumeBuckets);
