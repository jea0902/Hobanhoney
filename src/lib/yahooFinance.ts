import { logEvent } from "@/lib/logger";

export interface YahooQuote {
  price: number;
  changePercent: number;
  // 정규장이 열려 있는지. 야후가 서머타임까지 반영해 주는 정규장 시간 안이면서 최근에 체결이 있었을 때만 true
  // (공휴일이나 점심 휴장이면 시간 안이어도 체결이 없어서 false). 정규장 시간 정보가 없으면 null.
  isOpen: boolean | null;
}

// 체결 시각이 이보다 오래됐으면 장이 멈춘 것으로 본다. 야후 지수는 최대 20분쯤 지연되는 경우가 있어 넉넉히 잡음.
const STALE_TRADE_MS = 30 * 60 * 1000;

function isMarketOpen(meta: {
  currentTradingPeriod?: { regular?: { start: number; end: number } };
  regularMarketTime?: number;
}): boolean | null {
  const regular = meta.currentTradingPeriod?.regular;
  if (!regular || typeof meta.regularMarketTime !== "number") return null;
  const now = Date.now();
  const inSession = now >= regular.start * 1000 && now <= regular.end * 1000;
  return inSession && now - meta.regularMarketTime * 1000 <= STALE_TRADE_MS;
}

// 야후 파이낸스 비공식 시세 API. 공식 문서는 없지만 널리 쓰이는 안정적인 엔드포인트.
export async function getYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } },
    );
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") {
      logEvent("error", "yahoo_finance", "시세 조회 실패", `symbol=${symbol}`);
      return null;
    }
    return {
      price: meta.regularMarketPrice,
      changePercent: meta.regularMarketChangePercent ?? 0,
      isOpen: isMarketOpen(meta),
    };
  } catch (error) {
    logEvent(
      "error",
      "yahoo_finance",
      "시세 조회 중 예외 발생",
      `symbol=${symbol} ${String(error)}`,
    );
    return null;
  }
}
