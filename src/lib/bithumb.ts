export async function getUsdtKrwRate(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bithumb.com/public/ticker/USDT_KRW", {
      next: { revalidate: 10 },
    });
    const json = await res.json();
    if (json?.status !== "0000") return null;
    const price = json?.data?.closing_price;
    return price ? Number(price) : null;
  } catch {
    return null;
  }
}
