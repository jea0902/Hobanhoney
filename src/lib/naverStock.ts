import { logEvent } from "@/lib/logger";

// 네이버 증권 비공식 시세 API. 야후 파이낸스에 없는 한국 국채 금리를 여기서 받는다 (2026-10-11 조회 확인).
// 공식 출처가 필요해지면 한국은행 ECOS(무료, API 키 필요)로 바꿀 수 있다.
export async function getKoreaBond3Y(): Promise<{ value: number; changePercent: number } | null> {
  try {
    const res = await fetch("https://api.stock.naver.com/marketindex/bond/KR3YT=RR", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    const json = await res.json();
    if (!json?.closePrice) {
      logEvent(
        "error",
        "naver_stock",
        "한국 국채 3년 금리 조회 실패",
        JSON.stringify(json).slice(0, 200),
      );
      return null;
    }
    return { value: Number(json.closePrice), changePercent: Number(json.fluctuationsRatio) };
  } catch (error) {
    logEvent("error", "naver_stock", "한국 국채 3년 금리 조회 중 예외 발생", String(error));
    return null;
  }
}
