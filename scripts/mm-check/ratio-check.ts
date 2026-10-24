// 펌핑 신호 검증 A-1 (TODO 39번): "펌핑 전 60일 개인 롱/숏(전체 계정)이 높다"가 진짜 시점 신호인지 확인한다.
// 20쌍 계산에서 17/20쌍 펌핑 코인이 더 높았는데, (1) 그 코인이 원래 늘 높은 건지 (2) 떨어지던 코인이라 롱이 많았을 뿐인지 가린다.
// 실행: npm run mm-ratio-check -- data/mm-check/pairs-2026-10-24.csv
import { readFileSync } from "node:fs";
import { getMetricsCsv, parseMetrics } from "./archive.ts";

const DAY = 86_400_000;
const HISTORY_DAYS = 400; // 코인마다 볼 기간 (보관소 파일 하루 1개씩)
const WINDOW_DAYS = 60; // "직전 60일" 평균
const AHEAD_DAYS = 30; // 이 안에 펌핑이 시작되면 "곧 펌핑"
const MIN_RATIO_DAYS = 40; // 60일 중 롱숏 데이터가 이만큼은 있어야 계산

interface Day {
  time: number;
  close: number;
  allRatio?: number;
}

async function getDays(base: string) {
  const symbol = `${base}USDT`;
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&startTime=${Date.now() - HISTORY_DAYS * DAY}&limit=${HISTORY_DAYS}`,
  );
  const days: Day[] = ((await res.json()) as string[][]).map((c) => ({
    time: Number(c[0]),
    close: Number(c[4]),
  }));
  // 하루 파일 10개씩 동시에 받는다 (처음엔 코인당 1~2분, 다음부터는 저장해 둔 파일을 씀)
  for (let i = 0; i < days.length; i += 10) {
    const batch = days.slice(i, i + 10);
    const csvs = await Promise.all(
      batch.map((d) => getMetricsCsv(symbol, new Date(d.time).toISOString().slice(0, 10))),
    );
    batch.forEach((day, j) => {
      const rows = parseMetrics(csvs[j]);
      if (rows.length > 0) day.allRatio = rows.reduce((s, r) => s + r.allRatio, 0) / rows.length;
    });
  }
  return days;
}

// 날마다: 직전 60일 개인 롱/숏 평균, 직전 60일 가격 변화, 다음 30일 안에 펌핑(7일 안 종가 2배)이 시작됐는지
function dailyFeatures(days: Day[]) {
  const isPumpStart = days.map((d, i) => {
    const next = days.slice(i + 1, i + 8);
    return next.length === 7 && Math.max(...next.map((n) => n.close)) >= 2 * d.close;
  });
  const features: { time: number; ratio: number; priceChange: number; pumpSoon: boolean }[] = [];
  for (let i = WINDOW_DAYS; i + AHEAD_DAYS + 7 < days.length; i++) {
    const ratios = days
      .slice(i - WINDOW_DAYS + 1, i + 1)
      .map((d) => d.allRatio)
      .filter((v): v is number => v !== undefined);
    if (ratios.length < MIN_RATIO_DAYS) continue;
    features.push({
      time: days[i].time,
      ratio: ratios.reduce((a, b) => a + b, 0) / ratios.length,
      priceChange: days[i].close / days[i - WINDOW_DAYS].close - 1,
      pumpSoon: isPumpStart.slice(i + 1, i + 1 + AHEAD_DAYS).some(Boolean),
    });
  }
  return features;
}

async function main() {
  const file = process.argv[2];
  if (!file)
    throw new Error("사용법: npm run mm-ratio-check -- data/mm-check/pairs-2026-10-24.csv");
  const pairs = readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "")));

  const all: ReturnType<typeof dailyFeatures> = [];
  console.log(
    "(1) 같은 코인 안에서: 펌핑 기준일의 직전 60일 개인 롱/숏이 그 코인의 1년 중 몇 % 위치인가 (100% = 가장 높음)",
  );
  for (const [coin, , baseDate, , , , control] of pairs) {
    for (const base of [coin, control]) {
      const features = dailyFeatures(await getDays(base));
      all.push(...features);
      if (base !== coin) continue;
      const atBase = features.find((f) => f.time === Date.parse(baseDate));
      if (!atBase) {
        console.log(`  ${coin} ${baseDate}: 기준일 계산 불가 (데이터 부족 또는 기간 밖)`);
        continue;
      }
      const rank = features.filter((f) => f.ratio <= atBase.ratio).length / features.length;
      console.log(
        `  ${coin} ${baseDate}: 기준일 ${atBase.ratio.toFixed(2)} / 1년 중간값 ${median(features.map((f) => f.ratio)).toFixed(2)} → ${(rank * 100).toFixed(0)}% 위치, 직전 60일 가격 ${(atBase.priceChange * 100).toFixed(0)}%`,
      );
    }
  }

  // (2) 40개 코인의 모든 날을 "직전 60일 가격 변화"로 묶고, 그 안에서 롱/숏 높낮이별 "30일 안 펌핑 시작" 비율
  console.log(`\n(2) 40개 코인 × 날짜 ${all.length}개: 30일 안에 펌핑이 시작된 비율`);
  const priceGroups = [
    { label: "60일 -40% 이하", test: (p: number) => p <= -0.4 },
    { label: "60일 -40~0%", test: (p: number) => p > -0.4 && p <= 0 },
    { label: "60일 0% 초과", test: (p: number) => p > 0 },
  ];
  const ratioGroups = [
    { label: "롱/숏 1.5 미만", test: (r: number) => r < 1.5 },
    { label: "1.5~2.5", test: (r: number) => r >= 1.5 && r < 2.5 },
    { label: "2.5 이상", test: (r: number) => r >= 2.5 },
  ];
  for (const price of priceGroups) {
    const cells = ratioGroups.map((ratio) => {
      const group = all.filter((f) => price.test(f.priceChange) && ratio.test(f.ratio));
      const rate = group.filter((f) => f.pumpSoon).length / group.length;
      return `${ratio.label}: ${group.length === 0 ? "-" : (rate * 100).toFixed(1) + "%"} (${group.length}일)`;
    });
    console.log(`  ${price.label} | ${cells.join(" | ")}`);
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

main();
