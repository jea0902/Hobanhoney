// Arkham 손 검증용 목록 (TODO 39번): 최근 6개월 안 "7일 안 종가 2배" 펌핑 코인 20개와,
// 같은 시기(±30일)에 바이낸스 선물에 상장했고 비슷한 거래대금인데 한 번도 2배가 안 된 비교 코인을 짝지어 CSV로 쓴다.
// 실행: node scripts/mm-check/index.ts  → data/mm-check/pairs-YYYY-MM-DD.csv (엑셀에서 열어 Arkham 확인 결과를 채움)
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const DAY = 86_400_000;
const LOOKBACK_DAYS = 180; // 펌핑 시작일을 찾는 기간
const SKIP_AFTER_LISTING_DAYS = 14; // 상장 직후의 가격 형성은 펌핑으로 보지 않음
const PAIRS = 20;
const MUST_INCLUDE = ["SIREN", "LAB", "AKE", "IRYS"]; // 사용자가 MM 펌핑으로 본 코인
// 비교 대상이 될 수 없는 종목 (스테이블코인, 금 연동 토큰)
const NOT_COMPARABLE = ["USDC", "PAXG", "XAUT"];

interface Coin {
  base: string;
  listed: number;
  candles: { time: number; close: number; volume: number }[];
}

async function binance(path: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://fapi.binance.com${path}`);
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status !== 418) throw new Error(`Binance ${res.status} ${path}`);
    await sleep(60_000 * attempt);
  }
  throw new Error(`Binance 요청 한도가 계속됨: ${path}`);
}

// 상장 14일 이후, 그날 종가 대비 7일 안 종가가 2배 이상이 된 날들 (겹치지 않게 7일씩 건너뜀)
function findPumps(coin: Coin) {
  const pumps: { start: number; peak: number; gain: number }[] = [];
  const { candles } = coin;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time < coin.listed + SKIP_AFTER_LISTING_DAYS * DAY) continue;
    const next = candles.slice(i + 1, i + 8);
    const peak = next.reduce((best, c) => (c.close > best.close ? c : best), candles[i]);
    if (peak.close >= 2 * candles[i].close) {
      pumps.push({
        start: candles[i].time,
        peak: peak.time,
        gain: peak.close / candles[i].close - 1,
      });
      i += 7;
    }
  }
  return pumps;
}

// 기준일 전 30일 일 거래대금 중간값
function medianVolume(coin: Coin, before: number) {
  const volumes = coin.candles
    .filter((c) => c.time < before && c.time >= before - 30 * DAY)
    .map((c) => c.volume)
    .sort((a, b) => a - b);
  return volumes.length === 0 ? 0 : volumes[Math.floor(volumes.length / 2)];
}

const info = (await binance("/fapi/v1/exchangeInfo")) as {
  symbols: {
    symbol: string;
    baseAsset: string;
    contractType: string;
    quoteAsset: string;
    status: string;
    underlyingSubType: string[];
  }[];
};
const targets = info.symbols.filter(
  (s) =>
    s.contractType === "PERPETUAL" &&
    s.quoteAsset === "USDT" &&
    s.status === "TRADING" &&
    s.underlyingSubType.includes("Crypto") && // 주식·원자재 종목 제외
    !s.underlyingSubType.includes("Index"),
);

const coins: Coin[] = [];
for (const s of targets) {
  const rows = (await binance(
    `/fapi/v1/klines?symbol=${s.symbol}&interval=1d&limit=1500`,
  )) as string[][];
  const candles = rows.map((r) => ({
    time: Number(r[0]),
    close: Number(r[4]),
    volume: Number(r[7]),
  }));
  if (candles.length > 0) coins.push({ base: s.baseAsset, listed: candles[0].time, candles });
  await sleep(150);
}

const from = Date.now() - LOOKBACK_DAYS * DAY;
const neverPumped = coins.filter(
  (c) => !NOT_COMPARABLE.includes(c.base) && findPumps(c).length === 0,
);
// 코인마다 기간 안에서 가장 큰 펌핑 하나 (7일 뒤 결과가 있는 것만)
const pumped = coins.flatMap((coin) => {
  const inRange = findPumps(coin).filter((p) => p.start >= from && p.start <= Date.now() - 8 * DAY);
  if (inRange.length === 0) return [];
  return [{ coin, pump: inRange.reduce((a, b) => (b.gain > a.gain ? b : a)) }];
});

const chosen = [
  ...pumped.filter((p) => MUST_INCLUDE.includes(p.coin.base)),
  ...pumped
    .filter((p) => !MUST_INCLUDE.includes(p.coin.base))
    .sort((a, b) => b.pump.gain - a.pump.gain),
];

const used = new Set<string>();
const rows: string[][] = [];
for (const { coin, pump } of chosen) {
  if (rows.length >= PAIRS) break;
  const volume = medianVolume(coin, pump.start);
  const findControl = (matchVolume: boolean) =>
    neverPumped
      .filter(
        (c) =>
          !used.has(c.base) &&
          Math.abs(c.listed - coin.listed) <= 30 * DAY &&
          (!matchVolume ||
            (medianVolume(c, pump.start) >= volume / 3 &&
              medianVolume(c, pump.start) <= volume * 3)),
      )
      .sort((a, b) => Math.abs(a.listed - coin.listed) - Math.abs(b.listed - coin.listed))[0];
  // 사용자가 고른 코인은 거래대금이 비슷한 짝이 없어도 뺄 수 없어서 거래대금 조건 없이 짝짓는다
  // (2026-10-24 LAB: 펌핑 직전 일 거래대금 $3억으로 같은 시기 상장 코인 중 비슷한 게 없음)
  let control = findControl(true);
  let memo = "";
  if (!control && MUST_INCLUDE.includes(coin.base)) {
    control = findControl(false);
    memo = "거래대금 차이 큼";
  }
  if (!control) continue; // 짝이 없으면 비교가 안 되므로 빼고 다음 코인
  used.add(control.base);
  const date = (t: number) => new Date(t).toISOString().slice(0, 10);
  rows.push([
    coin.base,
    date(coin.listed),
    date(pump.start),
    date(pump.peak),
    `+${(pump.gain * 100).toFixed(0)}%`,
    `${(volume / 1e6).toFixed(1)}M`,
    control.base,
    date(control.listed),
    `${(medianVolume(control, pump.start) / 1e6).toFixed(1)}M`,
    "",
    "",
    "",
    "",
    "",
    "",
    memo,
  ]);
}

// 아래 빈 칸은 Arkham에서 확인해 채움. 비교 코인은 펌핑 코인의 기준일 전 60일을 같은 방법으로 봄.
const header = [
  "펌핑 코인",
  "선물 상장일",
  "기준일(이 날 종가 대비)",
  "7일 안 최고 종가일",
  "상승률",
  "기준일 전 30일 일 거래대금(중간값, USDT)",
  "비교 코인",
  "비교 코인 상장일",
  "비교 코인 같은 기간 일 거래대금",
  "펌핑 코인: 첫 MM 신호일",
  "펌핑 코인: 신호 종류(①프로젝트→MM ②거래소→MM ③MM→거래소 ④새 지갑 묶음)",
  "펌핑 코인: MM 이름",
  "펌핑 코인: 이동량(유통량 대비 %)",
  "비교 코인: MM 신호 있음?(같은 기간)",
  "비교 코인: 신호 종류",
  "메모",
];
const csv = [header, ...rows]
  .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
  .join("\r\n");
fs.mkdirSync("data/mm-check", { recursive: true });
const file = `data/mm-check/pairs-${new Date().toISOString().slice(0, 10)}.csv`;
// 엑셀이 한글을 깨뜨리지 않게 BOM을 붙인다
fs.writeFileSync(file, "﻿" + csv);
console.log(`펌핑 ${pumped.length}개 중 ${rows.length}쌍 → ${file}`);
for (const r of rows) console.log(r.slice(0, 9).join("  "));
