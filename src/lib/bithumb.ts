import { logEvent } from "@/lib/logger";

export async function getUsdtKrwRate(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bithumb.com/public/ticker/USDT_KRW", {
      // revalidate를 쓰면 기간이 지난 뒤 첫 요청에 오래된 환율을 돌려줘서 매번 새로 받는다.
      cache: "no-store",
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
