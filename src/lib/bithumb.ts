import { logEvent } from "@/lib/logger";

export async function getUsdtKrwRate(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bithumb.com/public/ticker/USDT_KRW", {
      next: { revalidate: 10 },
    });
    const json = await res.json();
    if (json?.status !== "0000") {
      logEvent("error", "bithumb", "USDT/KRW 시세 조회 실패", `status=${json?.status}`);
      return null;
    }
    const price = json?.data?.closing_price;
    return price ? Number(price) : null;
  } catch (error) {
    logEvent("error", "bithumb", "USDT/KRW 시세 조회 중 예외 발생", String(error));
    return null;
  }
}
