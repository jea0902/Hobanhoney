function toBybitSymbol(symbol: string) {
  return symbol.replace(/\//g, "").toUpperCase();
}

export async function getMarkPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${toBybitSymbol(symbol)}`,
    );
    const json = await res.json();
    const price = json?.result?.list?.[0]?.markPrice;
    return price ? Number(price) : null;
  } catch {
    return null;
  }
}

// 1시간봉 최대 1000개(약 41일)까지만 본다. 그보다 오래됐거나 Bybit에 없는 종목이면 null.
export async function getPriceRange(
  symbol: string,
  fromMs: number,
): Promise<{ low: number; high: number } | null> {
  const toMs = Date.now();
  if (toMs - fromMs > 1000 * 60 * 60 * 1000) return null;

  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${toBybitSymbol(symbol)}` +
        `&interval=60&start=${fromMs}&end=${toMs}&limit=1000`,
    );
    const json = await res.json();
    // 각 캔들: [시작시각, 시가, 고가, 저가, 종가, 거래량, 거래대금]
    const candles: string[][] = json?.result?.list ?? [];
    if (candles.length === 0) return null;
    return {
      low: Math.min(...candles.map((c) => Number(c[3]))),
      high: Math.max(...candles.map((c) => Number(c[2]))),
    };
  } catch {
    return null;
  }
}
