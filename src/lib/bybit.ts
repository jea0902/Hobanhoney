import { logEvent } from "@/lib/logger";

function normalizeSymbol(symbol: string) {
  return symbol.replace(/\//g, "").toUpperCase();
}

export async function getMarkPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${normalizeSymbol(symbol)}`,
      // revalidate를 쓰면 기간이 지난 뒤 첫 요청에 오래된 가격을 돌려줘서 매번 새로 받는다.
      { cache: "no-store" },
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
