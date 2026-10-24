// 펌핑 신호 검증 A-2 (TODO 39번) 데이터 모으기: 바이낸스 USDT 무기한 선물 전 종목의 최근 400일 일봉 + 하루 요약값
// (OI·개인/큰손 롱숏·테이커 비율)을 한 파일로 저장한다. 고른 40개만 보면 표본 편향이 생겨서 전 종목으로 본다.
// 실행: npm run mm-universe → data/mm-check/universe-days.json (처음엔 보관소 파일 약 20만 개라 오래 걸림, 다음부터는 저장분 사용)
// 분석은 npm run mm-universe-report (네트워크 없이 이 파일만 읽음)
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { getDailySummaries } from "./archive.ts";

const DAY = 86_400_000;
const HISTORY_DAYS = 400;

async function binance(path: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://fapi.binance.com${path}`);
    if (res.ok) return res.json();
    // 429는 요청 한도, 418은 한도를 무시하고 계속 보내서 IP가 잠시 막힌 상태
    if (res.status !== 429 && res.status !== 418) throw new Error(`Binance ${res.status} ${path}`);
    await sleep(60_000 * attempt);
  }
  throw new Error(`Binance 요청 한도가 계속됨: ${path}`);
}

const info = (await binance("/fapi/v1/exchangeInfo")) as {
  symbols: {
    symbol: string;
    baseAsset: string;
    contractType: string;
    quoteAsset: string;
    status: string;
    onboardDate: number;
    underlyingSubType: string[];
  }[];
};
// 지금 거래 중인 종목만 — 펌핑 후 상장폐지된 코인은 빠진다 (한계)
const targets = info.symbols.filter(
  (s) =>
    s.contractType === "PERPETUAL" &&
    s.quoteAsset === "USDT" &&
    s.status === "TRADING" &&
    s.underlyingSubType.includes("Crypto") && // 주식·원자재 종목 제외
    !s.underlyingSubType.includes("Index"),
);

const coins = [];
const startedAt = Date.now();
for (const [index, s] of targets.entries()) {
  const rows = (await binance(
    `/fapi/v1/klines?symbol=${s.symbol}&interval=1d&startTime=${Date.now() - HISTORY_DAYS * DAY}&limit=${HISTORY_DAYS}`,
  )) as string[][];
  const dates = rows.map((r) => new Date(Number(r[0])).toISOString().slice(0, 10));
  const summaries = await getDailySummaries(s.symbol, dates);
  coins.push({
    base: s.baseAsset,
    listed: s.onboardDate,
    days: rows.map((r, i) => ({
      date: dates[i],
      open: Number(r[1]),
      high: Number(r[2]),
      close: Number(r[4]),
      volume: Number(r[7]), // 거래대금 (USDT)
      trades: Number(r[8]), // 체결 건수
      ...(summaries[dates[i]] ?? {}),
    })),
  });
  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  console.log(`${index + 1}/${targets.length} ${s.symbol} (${minutes}분)`);
}

writeFileSync("data/mm-check/universe-days.json", JSON.stringify(coins));
console.log(`저장: data/mm-check/universe-days.json (${coins.length}종목)`);
