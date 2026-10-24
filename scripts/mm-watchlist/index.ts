// MM 펌핑 관찰 후보 (TODO 39번 A-2): 직전 60일 개인 롱/숏 평균 2.5 이상 + 큰손 롱/숏 평균 1.5 이상 + 30일 거래대금 중간값 $1~20M.
// 2026-10-25 전 종목(519개) 400일 분석에서 이 조합은 30일 안 펌핑(7일 안 종가 2배) 시작 비율이 약 11% (아무 날 평균 4.9%).
// 매매 신호가 아니라 지켜볼 코인을 좁히는 조건이라서, 매일 후보를 기록하고 38일 뒤 실제로 펌핑했는지 채워 앞으로도 맞는지 본다.
// 실행: npm run mm-watchlist (Oracle VM의 systemd 타이머가 하루 한 번 돌린다)
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { getDailySummaries } from "../mm-check/archive.ts";

const DAY = 86_400_000;
const WINDOW_DAYS = 60;
const MIN_RATIO_DAYS = 40; // 60일 중 롱숏 데이터가 이만큼은 있어야 계산 (분석과 같은 기준)
const MIN_ACCOUNT_RATIO = 2.5;
const MIN_TOP_RATIO = 1.5;
const MIN_VOLUME = 1_000_000;
const MAX_VOLUME = 20_000_000;
const AHEAD_DAYS = 30;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function binance(path: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://fapi.binance.com${path}`);
    if (res.ok) return res.json();
    // 429는 요청 한도, 418은 한도를 무시하고 계속 보내서 IP가 잠시 막힌 상태
    if (res.status !== 429 && res.status !== 418) {
      throw new Error(`Binance ${res.status} ${path}: ${await res.text()}`);
    }
    await sleep(30_000 * attempt);
  }
  throw new Error(`Binance 요청 한도가 계속됨: ${path}`);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function average(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function findCandidates() {
  const info = (await binance("/fapi/v1/exchangeInfo")) as {
    symbols: {
      symbol: string;
      contractType: string;
      quoteAsset: string;
      status: string;
      underlyingSubType: string[];
    }[];
  };
  const symbols = info.symbols
    .filter(
      (s) =>
        s.contractType === "PERPETUAL" &&
        s.quoteAsset === "USDT" &&
        s.status === "TRADING" &&
        s.underlyingSubType.includes("Crypto") && // 주식·원자재 종목 제외
        !s.underlyingSubType.includes("Index"),
    )
    .map((s) => s.symbol);

  // 어제(UTC)까지 끝난 일봉 60개
  const today = Math.floor(Date.now() / DAY) * DAY;
  const date = toDate(today - DAY);
  let saved = 0;
  for (const symbol of symbols) {
    const candles = (await binance(
      `/fapi/v1/klines?symbol=${symbol}&interval=1d&startTime=${today - WINDOW_DAYS * DAY}&limit=${WINDOW_DAYS}`,
    )) as string[][];
    const days = candles.filter((c) => Number(c[0]) < today);
    if (days.length < MIN_RATIO_DAYS) continue;
    const volume = median(days.slice(-30).map((c) => Number(c[7])));
    if (volume < MIN_VOLUME || volume >= MAX_VOLUME) continue;

    const dates = days.map((c) => toDate(Number(c[0])));
    // 저장 파일에는 예전 날짜도 들어 있어서 60일 창의 날짜만 꺼낸다
    const summaries = await getDailySummaries(symbol, dates);
    const found = dates.map((d) => summaries[d]).filter((s) => s != null);
    if (found.length < MIN_RATIO_DAYS) continue;
    const accountRatio = average(found.map((s) => s.allRatio));
    const topRatio = average(found.map((s) => s.topRatio));
    if (accountRatio < MIN_ACCOUNT_RATIO || topRatio < MIN_TOP_RATIO) continue;

    const { error } = await supabase.from("mm_watchlist").upsert(
      {
        date,
        symbol,
        account_ratio_60d: accountRatio,
        top_ratio_60d: topRatio,
        volume_30d: volume,
        price: Number(days[days.length - 1][4]),
      },
      { onConflict: "date,symbol", ignoreDuplicates: true },
    );
    if (error) throw error;
    saved++;
    console.log(
      `후보: ${symbol} 개인 ${accountRatio.toFixed(2)} 큰손 ${topRatio.toFixed(2)} 거래대금 $${(volume / 1e6).toFixed(1)}M`,
    );
    await sleep(200);
  }
  console.log(`${date} 기준 종목 ${symbols.length}개 중 후보 ${saved}개`);
}

// 기록일 다음 날부터 30일 안에 펌핑(그날 종가 대비 이후 7일 안 종가 2배)이 시작됐는지 채운다. 분석과 같은 정의.
async function fillResults() {
  const { data: rows, error } = await supabase
    .from("mm_watchlist")
    .select("id, symbol, date")
    .is("pumped_30d", null)
    .lte("date", toDate(Date.now() - (AHEAD_DAYS + 8) * DAY));
  if (error) throw error;
  for (const row of rows) {
    const candles = (await binance(
      `/fapi/v1/klines?symbol=${row.symbol}&interval=1d&startTime=${Date.parse(row.date) + DAY}&limit=${AHEAD_DAYS + 7}`,
    )) as string[][];
    if (candles.length < AHEAD_DAYS + 7) continue; // 상장 폐지 등으로 봉이 모자라면 다음 실행에서 다시 봄
    const closes = candles.map((c) => Number(c[4]));
    const pumped = closes
      .slice(0, AHEAD_DAYS)
      .some((close, j) => Math.max(...closes.slice(j + 1, j + 8)) >= 2 * close);
    const { error: updateError } = await supabase
      .from("mm_watchlist")
      .update({ pumped_30d: pumped, max_close_37d: Math.max(...closes) })
      .eq("id", row.id);
    if (updateError) throw updateError;
    await sleep(200);
  }
  console.log(`결과 채움 ${rows.length}건 확인`);
}

await findCandidates();
await fillResults();
