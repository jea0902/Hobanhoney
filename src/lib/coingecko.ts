import { logEvent } from "@/lib/logger";

// 전체 코인 시가총액 중 비트코인 비중(%). CoinGecko 공개 API는 키 없이 쓰지만 분당 호출 수가 적어서,
// 홈이 10초마다 새로고침돼도 5분에 한 번만 부르게 캐시한다 (몇 분 늦어도 되는 느린 지표라 괜찮음).
// 이 API는 현재 값만 줘서 전날 대비 변동은 없다.
export async function getBtcDominance(): Promise<number | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    const json = await res.json();
    const btc = json?.data?.market_cap_percentage?.btc;
    if (typeof btc !== "number") {
      logEvent(
        "error",
        "coingecko",
        "비트코인 도미넌스 조회 실패",
        JSON.stringify(json).slice(0, 200),
      );
      return null;
    }
    return btc;
  } catch (error) {
    logEvent("error", "coingecko", "비트코인 도미넌스 조회 중 예외 발생", String(error));
    return null;
  }
}
