// 펌핑 신호 검증 A (TODO 39번): pairs CSV의 20쌍으로 두 가지를 센다.
// 1) 시험 꼬리 — 기준일 전 60일 안에 "거래대금 폭증 + 장중 급등 + 제자리 마감"인 날이 펌핑 코인과 비교 코인에 몇 번 있었나
// 2) 개인 뒤집힘 — 펌핑 코인의 전체 계정 롱/숏이 1 아래로 내려간 날, 그 뒤 얼마나 더 올랐나, 다시 1 위로 올라간 날 이후 어땠나
// 실행: npm run mm-analyze -- data/mm-check/pairs-2026-10-24.csv → data/mm-check/analysis-YYYY-MM-DD.csv
import { readFileSync, writeFileSync } from "node:fs";
import { getDailySummaries } from "./archive.ts";

const DAY = 86_400_000;
const WINDOW_DAYS = 60; // 기준일 전 볼 기간
const AFTER_DAYS = 90; // 개인 뒤집힘을 볼 기준일 뒤 기간
// 시험 꼬리 조건 (2026-10-24 제안값, AKE·IRYS·LAB·LSK 관찰에서)
const WICK_VOLUME_X = 5; // 하루 거래대금이 직전 7일 중간값의 5배 이상
const WICK_HIGH = 0.2; // 장중 고가가 시가 대비 +20% 이상
const WICK_CLOSE = 0.1; // 종가가 시가 대비 ±10% 이내

interface Day {
  time: number;
  open: number;
  high: number;
  close: number;
  volume: number;
  oi?: number; // 그날 마지막 OI (코인 개수, 가격 변화에 안 흔들리게)
  allRatio?: number; // 전체 계정 롱/숏 하루 평균
  topRatio?: number; // 상위 트레이더 롱/숏(포지션) 하루 평균
}

async function getDays(symbol: string, from: number, to: number) {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&startTime=${from}&endTime=${to}&limit=500`,
  );
  const days: Day[] = ((await res.json()) as string[][]).map((c) => ({
    time: Number(c[0]),
    open: Number(c[1]),
    high: Number(c[2]),
    close: Number(c[4]),
    volume: Number(c[7]),
  }));

  const dateOf = (d: Day) => new Date(d.time).toISOString().slice(0, 10);
  const summaries = await getDailySummaries(symbol, days.map(dateOf));
  for (const day of days) {
    const summary = summaries[dateOf(day)];
    if (!summary) continue;
    day.oi = summary.oi;
    day.topRatio = summary.topRatio;
    day.allRatio = summary.allRatio;
  }
  return days;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// 기준일 전 60일 안의 시험 꼬리 날짜들
function findWicks(days: Day[], base: number) {
  const wicks: { daysBefore: number; oiChange: number | null }[] = [];
  days.forEach((day, i) => {
    if (day.time < base - WINDOW_DAYS * DAY || day.time > base || i < 7) return;
    const normal = median(days.slice(i - 7, i).map((d) => d.volume));
    const isWick =
      day.volume >= WICK_VOLUME_X * normal &&
      day.high / day.open - 1 >= WICK_HIGH &&
      Math.abs(day.close / day.open - 1) <= WICK_CLOSE;
    if (!isWick) return;
    const before = days[i - 1].oi;
    wicks.push({
      daysBefore: Math.round((base - day.time) / DAY),
      oiChange: before && day.oi ? day.oi / before - 1 : null,
    });
  });
  return wicks;
}

function averageIn(days: Day[], from: number, to: number, pick: (d: Day) => number | undefined) {
  const values = days
    .filter((d) => d.time >= from && d.time <= to)
    .map(pick)
    .filter((v): v is number => v !== undefined);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

// 기준일 뒤 개인(전체 계정)이 숏으로 뒤집힌 날과 그 뒤 가격
function findFlip(days: Day[], base: number) {
  const after = days.filter((d) => d.time > base);
  const flipIndex = after.findIndex((d) => d.allRatio !== undefined && d.allRatio < 1);
  if (flipIndex === -1) return null;
  const flip = after[flipIndex];
  const rest = after.slice(flipIndex);
  const backIndex = rest.findIndex((d) => d.allRatio !== undefined && d.allRatio > 1);
  const back = backIndex === -1 ? null : rest[backIndex];
  const baseClose = days.find((d) => d.time === base)?.close ?? NaN;
  const maxClose = (list: Day[]) => Math.max(...list.map((d) => d.close));
  const afterBack = back ? rest.slice(backIndex) : [];
  return {
    flipDaysAfterBase: Math.round((flip.time - base) / DAY),
    gainBeforeFlip: flip.close / baseClose - 1, // 기준일 → 뒤집힌 날
    maxGainAfterFlip: maxClose(rest) / flip.close - 1, // 뒤집힌 날 → 이후 최고 종가
    backDaysAfterFlip: back ? Math.round((back.time - flip.time) / DAY) : null,
    // 다시 롱으로 돌아선 날 이후 최고 종가가 그날보다 얼마나 높았나 (낮을수록 그날이 끝 무렵)
    maxGainAfterBack: back ? maxClose(afterBack) / back.close - 1 : null,
    // 다시 롱으로 돌아선 날 → 14일 뒤 종가
    change14dAfterBack: back && afterBack[14] ? afterBack[14].close / back.close - 1 : null,
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("사용법: npm run mm-analyze -- data/mm-check/pairs-2026-10-24.csv");
  const pairs = readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "")));

  const pct = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(0)}%`);
  const ratio = (v: number | null) => (v === null ? "" : v.toFixed(2));
  const out: string[][] = [
    [
      "펌핑 코인",
      "기준일",
      "시험 꼬리(펌핑)",
      "시험 꼬리(비교)",
      "비교 코인",
      "기준일 전 개인 롱/숏 평균(펌핑)",
      "기준일 전 개인 롱/숏 평균(비교)",
      "기준일 전 큰손 롱/숏 평균(펌핑)",
      "기준일 전 큰손 롱/숏 평균(비교)",
      "개인 숏 뒤집힘(기준일 뒤 며칠)",
      "기준일→뒤집힌 날",
      "뒤집힌 날→이후 최고",
      "다시 롱까지(일)",
      "다시 롱→이후 최고",
      "다시 롱→14일 뒤",
    ],
  ];

  for (const row of pairs) {
    const [coin, , baseDate, , , , control] = row;
    const base = Date.parse(baseDate);
    console.log(`${coin} vs ${control} (기준일 ${baseDate})`);
    const from = base - (WINDOW_DAYS + 7) * DAY;
    const pumpDays = await getDays(`${coin}USDT`, from, base + AFTER_DAYS * DAY);
    const controlDays = await getDays(`${control}USDT`, from, base);

    const wickText = (wicks: ReturnType<typeof findWicks>) =>
      wicks
        .map((w) => `${w.daysBefore}일 전(OI ${w.oiChange === null ? "?" : pct(w.oiChange)})`)
        .join(" ");
    const pumpWicks = findWicks(pumpDays, base);
    const controlWicks = findWicks(controlDays, base);
    const windowStart = base - WINDOW_DAYS * DAY;
    const flip = findFlip(pumpDays, base);

    out.push([
      coin,
      baseDate,
      `${pumpWicks.length}회 ${wickText(pumpWicks)}`,
      `${controlWicks.length}회 ${wickText(controlWicks)}`,
      control,
      ratio(averageIn(pumpDays, windowStart, base, (d) => d.allRatio)),
      ratio(averageIn(controlDays, windowStart, base, (d) => d.allRatio)),
      ratio(averageIn(pumpDays, windowStart, base, (d) => d.topRatio)),
      ratio(averageIn(controlDays, windowStart, base, (d) => d.topRatio)),
      flip ? String(flip.flipDaysAfterBase) : "없음",
      flip ? pct(flip.gainBeforeFlip) : "",
      flip ? pct(flip.maxGainAfterFlip) : "",
      flip?.backDaysAfterFlip === null || !flip ? "" : String(flip.backDaysAfterFlip),
      flip ? pct(flip.maxGainAfterBack) : "",
      flip ? pct(flip.change14dAfterBack) : "",
    ]);
  }

  const csv = out
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const outFile = `data/mm-check/analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  // 엑셀이 한글을 깨뜨리지 않게 BOM을 붙인다
  writeFileSync(outFile, "﻿" + csv);
  console.log(`저장: ${outFile}`);
  for (const r of out) console.log(r.join(" | "));
}

main();
