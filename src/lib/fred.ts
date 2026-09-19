import { logEvent } from "@/lib/logger";

export interface FredValue {
  value: number;
  previousValue: number | null;
}

type FredUnits = "lin" | "pc1" | "chg";

async function getFredSeries(seriesId: string, units: FredUnits): Promise<FredValue | null> {
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2&units=${units}`,
      { next: { revalidate: 3600 } },
    );
    const json = await res.json();
    const observations = json?.observations;
    if (!Array.isArray(observations) || observations.length === 0) {
      logEvent("error", "fred", "지표 조회 실패", `series=${seriesId}`);
      return null;
    }

    const value = Number(observations[0]?.value);
    if (Number.isNaN(value)) {
      logEvent("error", "fred", "지표 값 파싱 실패", `series=${seriesId}`);
      return null;
    }

    const previousRaw = observations[1]?.value;
    const previousValue = previousRaw !== undefined ? Number(previousRaw) : null;

    return { value, previousValue: Number.isNaN(previousValue!) ? null : previousValue };
  } catch (error) {
    logEvent("error", "fred", "지표 조회 중 예외 발생", `series=${seriesId} ${String(error)}`);
    return null;
  }
}

// 연준 기준금리 (Effective Federal Funds Rate, %)
export function getFedFundsRate() {
  return getFredSeries("FEDFUNDS", "lin");
}

// CPI 전년동월비 (%)
export function getCpiYoy() {
  return getFredSeries("CPIAUCSL", "pc1");
}

// PCE 물가지수 전년동월비 (%) — Fed가 공식적으로 더 중시하는 인플레이션 지표
export function getPceYoy() {
  return getFredSeries("PCEPI", "pc1");
}

// 비농업고용지수 전월 대비 증감 (천 명)
export function getNonfarmPayrollChange() {
  return getFredSeries("PAYEMS", "chg");
}

// 실업률 (%)
export function getUnemploymentRate() {
  return getFredSeries("UNRATE", "lin");
}

// 하이일드 신용스프레드 (ICE BofA US High Yield OAS, %p)
export function getCreditSpread() {
  return getFredSeries("BAMLH0A0HYM2", "lin");
}

// 미국채 1년물 금리 (%) — Yahoo Finance엔 정확히 1년 만기 지표가 없어 FRED 사용
export function getUst1Y() {
  return getFredSeries("DGS1", "lin");
}
