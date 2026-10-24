// 바이낸스 공식 보관소(data.binance.vision)의 선물 하루 metrics 파일. API(openInterestHist 등)는 30일까지만 줘서 이걸 쓴다.
// 컬럼: create_time, symbol, sum_open_interest, sum_open_interest_value, count_toptrader_long_short_ratio,
//       sum_toptrader_long_short_ratio, count_long_short_ratio, sum_taker_long_short_vol_ratio (5분 간격)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const DAY = 86_400_000;
const CACHE_DIR = "data/mm-check/cache";

// zip에는 CSV 하나만 들어 있다. 압축 해제 라이브러리 없이 zip 앞부분(로컬 헤더)만 읽어서 푼다.
function unzipSingleFile(zip: Buffer) {
  const compressedSize = zip.readUInt32LE(18);
  const start = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
  return inflateRawSync(zip.subarray(start, start + compressedSize)).toString("utf8");
}

// 하루치 CSV 내용 (없는 날은 빈 문자열). 같은 파일을 다시 받지 않게 풀어둔 CSV를 저장해 둔다.
export async function getMetricsCsv(symbol: string, date: string) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cached = `${CACHE_DIR}/${symbol}-${date}.csv`;
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  const res = await fetch(
    `https://data.binance.vision/data/futures/um/daily/metrics/${symbol}/${symbol}-metrics-${date}.zip`,
  );
  const csv = res.ok ? unzipSingleFile(Buffer.from(await res.arrayBuffer())) : "";
  // 없는 날도 빈 파일로 남겨서 다시 요청하지 않는다. 단 최근 사흘은 아직 안 올라왔을 수 있어서 남기지 않음
  if (res.ok || Date.parse(date) < Date.now() - 3 * DAY) writeFileSync(cached, csv);
  return csv;
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
