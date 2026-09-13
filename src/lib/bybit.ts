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
    return price ? Number(price) : null;
  } catch {
    return null;
  }
}
