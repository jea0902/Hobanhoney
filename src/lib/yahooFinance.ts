export interface YahooQuote {
  price: number;
  changePercent: number;
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
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      price: meta.regularMarketPrice,
      changePercent: meta.regularMarketChangePercent ?? 0,
    };
  } catch {
    return null;
  }
}
