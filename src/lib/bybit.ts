import { logEvent } from "@/lib/logger";

function normalizeSymbol(symbol: string) {
  return symbol.replace(/\//g, "").toUpperCase();
}

export async function getMarkPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${normalizeSymbol(symbol)}`,
      { next: { revalidate: 10 } },
    );
    const json = await res.json();
    const price = json?.result?.list?.[0]?.markPrice;
    if (!price) {
      logEvent("error", "bybit", "마크 프라이스 조회 실패", `symbol=${symbol}`);
      return null;
    }
    return Number(price);
  } catch (error) {
    logEvent(
      "error",
      "bybit",
      "마크 프라이스 조회 중 예외 발생",
      `symbol=${symbol} ${String(error)}`,
    );
    return null;
  }
}
