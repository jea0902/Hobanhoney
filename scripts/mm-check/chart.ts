// 펌핑 코인 하나의 선물 데이터(가격·OI·펀딩비·롱숏 비율·테이커 매수 비율)를 1시간 단위로 한 화면에 그린다.
// "세력이 작전을 하면 선물 데이터에 어떤 흔적이 남는지"를 눈으로 먼저 확인하려는 것 (TODO 39번 A).
// 실행: npm run mm-chart -- AKEUSDT 2026-05-01 2026-10-01 → data/mm-check/charts/AKEUSDT.html
//
// OI·롱숏 비율은 API(openInterestHist 등)가 30일까지만 줘서, 바이낸스 공식 보관소의 하루 단위 metrics 파일을 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Point {
  time: number;
  price?: number;
  volumeUsd?: number;
  oiUsd?: number;
  topPositionRatio?: number; // 증거금 상위 20% 계정의 롱 포지션 ÷ 숏 포지션
  allAccountRatio?: number; // 전체 계정 중 롱 계정 ÷ 숏 계정
  takerRatio?: number; // 테이커 매수량 ÷ 매도량
  funding?: number;
}

// 보관소 zip에는 CSV 파일 하나만 들어 있다. 압축 해제 라이브러리 없이 zip 앞부분(로컬 헤더)만 읽어서 푼다.
function unzipSingleFile(zip: Buffer) {
  const compressedSize = zip.readUInt32LE(18);
  const nameLength = zip.readUInt16LE(26);
  const extraLength = zip.readUInt16LE(28);
  const start = 30 + nameLength + extraLength;
  return inflateRawSync(zip.subarray(start, start + compressedSize)).toString("utf8");
}

async function getMetrics(symbol: string, from: number, to: number) {
  const points = new Map<number, Point>();
  for (let day = from; day < to; day += DAY) {
    const date = new Date(day).toISOString().slice(0, 10);
    const url = `https://data.binance.vision/data/futures/um/daily/metrics/${symbol}/${symbol}-metrics-${date}.zip`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  ${date} metrics 없음 (${res.status})`);
      continue;
    }
    const csv = unzipSingleFile(Buffer.from(await res.arrayBuffer()));
    // 컬럼: create_time, symbol, sum_open_interest, sum_open_interest_value, count_toptrader_long_short_ratio,
    //       sum_toptrader_long_short_ratio, count_long_short_ratio, sum_taker_long_short_vol_ratio (5분 간격)
    for (const line of csv.trim().split("\n").slice(1)) {
      const cols = line.split(",");
      const time = Date.parse(cols[0].replace(" ", "T") + "Z");
      if (time % HOUR !== 0) continue; // 정시 값만 써서 1시간 단위로 맞춘다
      points.set(time, {
        time,
        oiUsd: Number(cols[3]),
        topPositionRatio: Number(cols[5]),
        allAccountRatio: Number(cols[6]),
        takerRatio: Number(cols[7]),
      });
    }
  }
  return points;
}

async function addCandles(points: Map<number, Point>, symbol: string, from: number, to: number) {
  for (let start = from; start < to; start += 1000 * HOUR) {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&startTime=${start}&endTime=${Math.min(start + 1000 * HOUR, to) - 1}&limit=1000`,
    );
    for (const c of (await res.json()) as string[][]) {
      // 1시간봉 종가 = 다음 정시의 가격 (metrics의 정시 값과 같은 시각으로 맞춘다)
      const time = Number(c[0]) + HOUR;
      const point = points.get(time) ?? { time };
      point.price = Number(c[4]);
      point.volumeUsd = Number(c[7]);
      points.set(time, point);
    }
  }
}

async function addFunding(points: Map<number, Point>, symbol: string, from: number, to: number) {
  let start = from;
  while (start < to) {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&startTime=${start}&endTime=${to}&limit=1000`,
    );
    const rows = (await res.json()) as { fundingTime: number; fundingRate: string }[];
    if (rows.length === 0) break;
    for (const row of rows) {
      const time = Math.floor(row.fundingTime / HOUR) * HOUR;
      const point = points.get(time) ?? { time };
      point.funding = Number(row.fundingRate);
      points.set(time, point);
    }
    start = rows[rows.length - 1].fundingTime + 1;
  }
}

// 패널 하나 = 값 하나를 꺾은선(또는 막대)으로. 같은 그림이 6번 반복돼서 함수로 뺐다.
function panel(
  title: string,
  points: Point[],
  pick: (p: Point) => number | undefined,
  options: { log?: boolean; bars?: boolean; baseline?: number; color: string },
) {
  const width = 1400;
  const height = 150;
  // 보관소 파일에 OI가 0으로 찍힌 시점이 있다(IRYS). 로그 눈금에서 0은 그릴 수 없어서 빈칸으로 둔다.
  const values = points
    .map(pick)
    .map((v) => (options.log && v !== undefined && v <= 0 ? undefined : v));
  const shown = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (shown.length === 0) return `<h3>${title}: 데이터 없음</h3>`;
  const scale = (v: number) => (options.log ? Math.log10(v) : v);
  let min = Math.min(...shown.map(scale));
  let max = Math.max(...shown.map(scale));
  if (options.baseline !== undefined) {
    min = Math.min(min, scale(options.baseline));
    max = Math.max(max, scale(options.baseline));
  }
  const t0 = points[0].time;
  const t1 = points[points.length - 1].time;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * width;
  const y = (v: number) => height - ((scale(v) - min) / (max - min || 1)) * height;

  let marks = "";
  for (let t = Math.ceil(t0 / DAY) * DAY; t <= t1; t += DAY) {
    const d = new Date(t);
    if (d.getUTCDate() !== 1 && d.getUTCDate() !== 15) continue;
    marks += `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${height}" stroke="#ddd"/><text x="${x(t) + 2}" y="${height - 2}" font-size="10" fill="#888">${d.toISOString().slice(5, 10)}</text>`;
  }
  if (options.baseline !== undefined) {
    const by = y(options.baseline);
    marks += `<line x1="0" x2="${width}" y1="${by}" y2="${by}" stroke="#999" stroke-dasharray="4 3"/>`;
  }

  let body = "";
  if (options.bars) {
    const zero = y(options.baseline ?? 0);
    points.forEach((p, i) => {
      const v = values[i];
      if (v === undefined) return;
      const top = Math.min(zero, y(v));
      body += `<rect x="${x(p.time)}" y="${top}" width="2" height="${Math.abs(zero - y(v)) + 0.5}" fill="${v >= (options.baseline ?? 0) ? "#2a9d5c" : "#d64545"}"/>`;
    });
  } else {
    const path = points
      .map((p, i) =>
        values[i] === undefined ? "" : `${x(p.time).toFixed(1)},${y(values[i]!).toFixed(1)}`,
      )
      .filter(Boolean)
      .join(" L");
    body = `<path d="M${path}" fill="none" stroke="${options.color}" stroke-width="1.2"/>`;
  }

  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toPrecision(3));
  const rawMin = options.log ? 10 ** min : min;
  const rawMax = options.log ? 10 ** max : max;
  return `<h3>${title} <small>(${fmt(rawMin)} ~ ${fmt(rawMax)}${options.log ? ", 로그 눈금" : ""})</small></h3>
<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${marks}${body}</svg>`;
}

async function main() {
  const [symbol, fromDate, toDate] = process.argv.slice(2);
  if (!symbol || !fromDate || !toDate) {
    throw new Error("사용법: npm run mm-chart -- AKEUSDT 2026-05-01 2026-10-01");
  }
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);

  console.log(`${symbol} ${fromDate} ~ ${toDate} 받는 중`);
  const map = await getMetrics(symbol, from, to);
  await addCandles(map, symbol, from, to);
  await addFunding(map, symbol, from, to);
  const points = [...map.values()].sort((a, b) => a.time - b.time);

  // 펀딩비는 8시간(또는 4시간)마다라 그 사이 시각은 비어 있다. 막대로 그리면 빈칸 없이 보인다.
  const html = `<!doctype html><meta charset="utf-8"><title>${symbol}</title>
<body style="font-family:sans-serif;margin:16px">
<h2>${symbol} ${fromDate} ~ ${toDate} (1시간, UTC)</h2>
${panel("가격", points, (p) => p.price, { log: true, color: "#222" })}
${panel("미결제약정 OI (USD)", points, (p) => p.oiUsd, { log: true, color: "#1f6feb" })}
${panel("펀딩비 (초록 +, 빨강 -)", points, (p) => p.funding, { bars: true, baseline: 0, color: "" })}
${panel("상위 트레이더 롱/숏 (포지션 기준, 1 = 반반)", points, (p) => p.topPositionRatio, { log: true, baseline: 1, color: "#8250df" })}
${panel("전체 계정 롱/숏 (계정 수 기준, 1 = 반반)", points, (p) => p.allAccountRatio, { log: true, baseline: 1, color: "#bf8700" })}
${panel("테이커 매수/매도 (1 = 반반)", points, (p) => p.takerRatio, { log: true, baseline: 1, color: "#999" })}
${panel("1시간 거래대금 (USDT)", points, (p) => p.volumeUsd, { bars: true, baseline: 0, color: "" })}
</body>`;

  mkdirSync("data/mm-check/charts", { recursive: true });
  const out = `data/mm-check/charts/${symbol}.html`;
  writeFileSync(out, html);
  console.log(`저장: ${out} (${points.length}개 시점)`);
}

main();
