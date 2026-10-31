import { logEvent } from "@/lib/logger";

// 한국은행 ECOS 월간 KB 주택매매가격지수 중 서울 아파트 (통계표 901Y062, 항목 P63ACA, 기준 2026.01=100, 2026-10-31 확인).
// 월간 통계라 하루 단위로 바뀌지 않는다. 전월 대비 변화율과 함께 돌려준다.
export async function getSeoulApartmentIndex(): Promise<{
  month: string; // "202610"
  value: number;
  changePercent: number;
} | null> {
  const now = new Date();
  const to = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const from = `${now.getFullYear() - 1}${to.slice(4)}`;
  try {
    const res = await fetch(
      `https://ecos.bok.or.kr/api/StatisticSearch/${process.env.ECOS_API_KEY}/json/kr/1/100/901Y062/M/${from}/${to}/P63ACA`,
      { next: { revalidate: 3600 } },
    );
    const json = await res.json();
    const rows: { TIME: string; DATA_VALUE: string }[] = json?.StatisticSearch?.row ?? [];
    if (rows.length < 2) {
      logEvent(
        "error",
        "ecos_housing",
        "서울 아파트 지수 조회 실패",
        JSON.stringify(json).slice(0, 200),
      );
      return null;
    }
    const last = rows[rows.length - 1];
    const before = rows[rows.length - 2];
    const value = Number(last.DATA_VALUE);
    return {
      month: last.TIME,
      value,
      changePercent: (value / Number(before.DATA_VALUE) - 1) * 100,
    };
  } catch (error) {
    logEvent("error", "ecos_housing", "서울 아파트 지수 조회 중 예외 발생", String(error));
    return null;
  }
}
