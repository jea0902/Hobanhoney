// 바이낸스 USDT 무기한 선물에서 "가격은 그대로인데 미결제약정(OI)만 4시간 새 급증"한 종목을 찾아 oi_alerts에 기록하고,
// 72시간이 지난 기록에는 이후 가격(24h·72h·72h 안 최고가)을 채운다. 신호가 정말 펌핑을 앞서는지 검증하려는 것.
// 실행: npm run oi-alerts (Oracle VM의 systemd 타이머가 매시 5분에 돌린다)
//
// 2026-10-24 지난 30일 전 종목(522개)으로 미리 본 결과: 아무 시점의 72시간 안 +100% 비율 0.5% → 알림 시점 5.9% (34회 중 2회).
// 표본이 작아 결론을 못 내서, 알림마다 무작위 비교 종목 1개를 같이 기록해 앞으로 쌓이는 결과로 비교한다.
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const OI_JUMP = 0.3; // 4시간 OI +30% 이상
const PRICE_FLAT = 0.05; // 같은 4시간 가격 변화 ±5% 이내
const MIN_OI_USD = 1_000_000; // 너무 작은 코인의 잡음 제외
const HOUR = 3_600_000;

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

interface Snapshot {
  symbol: string;
  at: number; // OI 기록 시각 (정시, ms)
  oiUsd: number;
  oiChange: number;
}

// 최근 5개 1시간 OI로 "지금 vs 4시간 전" 변화를 구한다. 바이낸스가 30일치를 보관해서 우리가 따로 쌓을 필요가 없다.
async function getSnapshot(symbol: string): Promise<Snapshot | null> {
  const rows = (await binance(
    `/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=5`,
  )) as { timestamp: number; sumOpenInterestValue: string }[];
  if (rows.length < 5) return null; // 상장한 지 4시간이 안 된 종목
  const now = Number(rows[4].sumOpenInterestValue);
  const before = Number(rows[0].sumOpenInterestValue);
  return { symbol, at: rows[4].timestamp, oiUsd: now, oiChange: now / before - 1 };
}

// at 시각의 가격과 4시간 전 대비 변화. 1시간봉 종가 = 다음 정시의 가격.
async function getPriceChange(symbol: string, at: number) {
  const candles = (await binance(
    `/fapi/v1/klines?symbol=${symbol}&interval=1h&startTime=${at - 5 * HOUR}&limit=5`,
  )) as string[][];
  const price = Number(candles[4][4]);
  return { price, priceChange: price / Number(candles[0][4]) - 1 };
}

async function getFundingRate(symbol: string) {
  const index = (await binance(`/fapi/v1/premiumIndex?symbol=${symbol}`)) as {
    lastFundingRate: string;
  };
  return Number(index.lastFundingRate);
}

async function saveRow(
  snapshot: Snapshot,
  kind: "alert" | "control",
  price: number,
  priceChange: number,
) {
  const { error } = await supabase.from("oi_alerts").upsert(
    {
      symbol: snapshot.symbol,
      kind,
      alerted_at: new Date(snapshot.at).toISOString(),
      oi_usd: snapshot.oiUsd,
      oi_change_4h: snapshot.oiChange,
      price,
      price_change_4h: priceChange,
      funding_rate: await getFundingRate(snapshot.symbol),
    },
    { onConflict: "symbol,alerted_at,kind", ignoreDuplicates: true },
  );
  if (error) throw error;
}

async function findAlerts() {
  const info = (await binance("/fapi/v1/exchangeInfo")) as {
    symbols: { symbol: string; contractType: string; quoteAsset: string; status: string }[];
  };
  const symbols = info.symbols
    .filter(
      (s) => s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && s.status === "TRADING",
    )
    .map((s) => s.symbol);

  const snapshots: Snapshot[] = [];
  for (const symbol of symbols) {
    try {
      const snapshot = await getSnapshot(symbol);
      if (snapshot && snapshot.oiUsd >= MIN_OI_USD) snapshots.push(snapshot);
    } catch (error) {
      console.log(`${symbol} OI 못 받음: ${(error as Error).message}`);
    }
    await sleep(200);
  }

  // 같은 종목은 24시간에 한 번만 알림 (급증이 몇 시간 이어지면 매시간 같은 알림이 쌓이므로)
  const { data: recent, error } = await supabase
    .from("oi_alerts")
    .select("symbol")
    .eq("kind", "alert")
    .gte("alerted_at", new Date(Date.now() - 24 * HOUR).toISOString());
  if (error) throw error;
  const alertedRecently = new Set(recent.map((r) => r.symbol));

  const candidates = snapshots.filter(
    (s) => s.oiChange >= OI_JUMP && !alertedRecently.has(s.symbol),
  );
  const quiet = snapshots.filter((s) => s.oiChange < OI_JUMP);
  let alerts = 0;
  for (const snapshot of candidates) {
    const { price, priceChange } = await getPriceChange(snapshot.symbol, snapshot.at);
    if (Math.abs(priceChange) > PRICE_FLAT) continue;
    await saveRow(snapshot, "alert", price, priceChange);
    // 비교 대상: 같은 시각, 같은 OI 하한을 넘지만 급증은 없는 종목 중 무작위 1개
    const control = quiet[Math.floor(Math.random() * quiet.length)];
    if (control) {
      const controlPrice = await getPriceChange(control.symbol, control.at);
      await saveRow(control, "control", controlPrice.price, controlPrice.priceChange);
    }
    alerts++;
    console.log(
      `알림: ${snapshot.symbol} OI $${(snapshot.oiUsd / 1e6).toFixed(1)}M (${(snapshot.oiChange * 100).toFixed(0)}%), ` +
        `가격 ${price} (${(priceChange * 100).toFixed(1)}%), 비교 ${control?.symbol ?? "없음"}`,
    );
  }
  console.log(
    `종목 ${symbols.length}개 중 OI $1M 이상 ${snapshots.length}개 확인, 알림 ${alerts}건`,
  );
}

// 72시간이 지난 기록에 이후 가격을 채운다.
async function fillResults() {
  const { data: rows, error } = await supabase
    .from("oi_alerts")
    .select("id, symbol, alerted_at")
    .is("max_high_72h", null)
    .lte("alerted_at", new Date(Date.now() - 73 * HOUR).toISOString());
  if (error) throw error;
  for (const row of rows) {
    const at = new Date(row.alerted_at).getTime();
    // 알림 시각부터 시작하는 1시간봉 72개. i번째 봉의 종가 = 알림 (i+1)시간 뒤 가격.
    const candles = (await binance(
      `/fapi/v1/klines?symbol=${row.symbol}&interval=1h&startTime=${at}&limit=72`,
    )) as string[][];
    if (candles.length < 72) continue; // 상장 폐지 등으로 봉이 모자라면 건너뛴다 (다음 실행에서 다시 봄)
    const { error: updateError } = await supabase
      .from("oi_alerts")
      .update({
        price_24h: Number(candles[23][4]),
        price_72h: Number(candles[71][4]),
        max_high_72h: Math.max(...candles.map((c) => Number(c[2]))),
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
    await sleep(200);
  }
  console.log(`결과 채움 ${rows.length}건 확인`);
}

await findAlerts();
await fillResults();
