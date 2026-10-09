import { logEvent } from "@/lib/logger";

function normalizeSymbol(symbol: string) {
  return symbol.replace(/\//g, "").toUpperCase();
}

// 역발상 신호등용 공개 데이터 3종. 실패하면 null을 돌려주고 신호등에서 "데이터 없음"으로 보여준다.

// Bybit 계정 수 기준 롱/숏 비율(일봉). 개인 투자자가 어느 쪽에 쏠렸는지 보는 용도.
export async function getLongShortRatio(
  symbol: string,
): Promise<{ longRatio: number; shortRatio: number } | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=1d&limit=1`,
      { cache: "no-store" },
    );
    const json = await res.json();
    const latest = json?.result?.list?.[0];
    if (!latest) return null;
    return { longRatio: Number(latest.buyRatio), shortRatio: Number(latest.sellRatio) };
  } catch {
    return null;
  }
}

export async function getFundingRate(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    const rate = json?.result?.list?.[0]?.fundingRate;
    return rate ? Number(rate) : null;
  } catch {
    return null;
  }
}

// 일봉 종가를 오래된 것부터 돌려준다 (Bybit은 최신순으로 줌). 마지막 값은 진행 중인 오늘 캔들.
export async function getDailyCloses(symbol: string, limit: number): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=D&limit=${limit}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    // 각 캔들: [시작시각, 시가, 고가, 저가, 종가, 거래량, 거래대금]
    const candles: string[][] = json?.result?.list ?? [];
    if (candles.length === 0) return null;
    return candles.map((candle) => Number(candle[4])).reverse();
  } catch {
    return null;
  }
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
