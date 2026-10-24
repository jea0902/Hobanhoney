// 바이낸스 공식 보관소(data.binance.vision)의 선물 하루 metrics 파일. API(openInterestHist 등)는 30일까지만 줘서 이걸 쓴다.
// 컬럼: create_time, symbol, sum_open_interest, sum_open_interest_value, count_toptrader_long_short_ratio,
//       sum_toptrader_long_short_ratio, count_long_short_ratio, sum_taker_long_short_vol_ratio (5분 간격)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const DAY = 86_400_000;
const SUMMARY_DIR = "data/mm-check/daily";

// zip에는 CSV 하나만 들어 있다. 압축 해제 라이브러리 없이 zip 앞부분(로컬 헤더)만 읽어서 푼다.
function unzipSingleFile(zip: Buffer) {
  const compressedSize = zip.readUInt32LE(18);
  const start = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
  return inflateRawSync(zip.subarray(start, start + compressedSize)).toString("utf8");
}

// 하루치 CSV 내용 (없는 날은 빈 문자열). 원본은 저장하지 않는다 — 40개 코인 1년치가 532MB라서.
export async function getMetricsCsv(symbol: string, date: string) {
  const res = await fetch(
    `https://data.binance.vision/data/futures/um/daily/metrics/${symbol}/${symbol}-metrics-${date}.zip`,
  );
  return res.ok ? unzipSingleFile(Buffer.from(await res.arrayBuffer())) : "";
}

// CSV를 숫자 행으로. OI가 0으로 찍힌 잘못된 행(IRYS 보관소)은 뺀다.
export function parseMetrics(csv: string) {
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const cols = line.split(",");
      return {
        time: Date.parse(cols[0].replace(" ", "T") + "Z"),
        oi: Number(cols[2]),
        oiUsd: Number(cols[3]),
        topRatio: Number(cols[5]),
        allRatio: Number(cols[6]),
        takerRatio: Number(cols[7]),
      };
    })
    .filter((r) => r.oi > 0);
}

export interface DailySummary {
  oi: number; // 그날 마지막 OI (코인 개수)
  oiUsd: number; // 그날 마지막 OI (USD)
  allRatio: number; // 전체 계정 롱/숏 하루 평균
  topRatio: number; // 상위 트레이더 롱/숏(포지션) 하루 평균
  takerRatio: number; // 테이커 매수/매도 하루 평균
}

function summarize(csv: string): DailySummary | null {
  const rows = parseMetrics(csv);
  if (rows.length === 0) return null;
  const average = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((sum, r) => sum + pick(r), 0) / rows.length;
  const last = rows[rows.length - 1];
  return {
    oi: last.oi,
    oiUsd: last.oiUsd,
    allRatio: average((r) => r.allRatio),
    topRatio: average((r) => r.topRatio),
    takerRatio: average((r) => r.takerRatio),
  };
}

// 날짜별 하루 요약값. 종목마다 JSON 하나에 저장해 두고 없는 날짜만 받는다 (null = 그날 파일 없음).
export async function getDailySummaries(symbol: string, dates: string[]) {
  mkdirSync(SUMMARY_DIR, { recursive: true });
  const file = `${SUMMARY_DIR}/${symbol}.json`;
  const saved: Record<string, DailySummary | null> = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {};
  const missing = dates.filter((date) => !(date in saved));
  // 10개씩 동시에 받는다
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    const csvs = await Promise.all(batch.map((date) => getMetricsCsv(symbol, date)));
    batch.forEach((date, j) => {
      const summary = summarize(csvs[j]);
      // 최근 사흘은 아직 안 올라왔을 수 있어서 "없음"으로 저장하지 않는다
      if (summary || Date.parse(date) < Date.now() - 3 * DAY) saved[date] = summary;
    });
  }
  if (missing.length > 0) writeFileSync(file, JSON.stringify(saved));
  return saved;
}
