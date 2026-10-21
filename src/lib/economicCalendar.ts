import { logEvent } from "@/lib/logger";

// 증시 캘린더 (TODO.md 21번). 한 출처로 다 되는 무료 API가 없어서 세 가지를 합친다.
// - 이번 주 세계 일정: Forex Factory 주간 피드 (비공식, 이번 주만, 한국 없음, 예상치·이전치 있음)
// - 다음 주 이후 미국 일정: FRED 발표 일정 + FOMC 날짜 (날짜만 줘서 공식 발표 시각을 붙임)
// - 한국: 금통위 날짜 (무료 API를 못 찾아 직접 적음)
// 인베스팅닷컴은 서버 요청을 403으로 막아서 쓰지 않음 (2026-10-21 확인).

export interface CalendarEvent {
  time: number; // 발표 시각 (ms). hasTime이 false면 그날 한국시간 0시
  hasTime: boolean;
  country: string; // 한글 국가·지역 이름
  title: string;
  high: boolean; // 중요도 높음 (아니면 중간)
  forecast: string | null;
  previous: string | null;
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
const DAYS_AHEAD = 14;

// FOMC 결과는 회의 둘째 날 미 동부 14:00 발표. 연준 공식 일정(federalreserve.gov, 2026-10-21 확인).
const FOMC_DECISION_DATES = [
  "2026-10-28",
  "2026-12-09",
  "2027-01-27",
  "2027-03-17",
  "2027-04-28",
  "2027-06-09",
  "2027-07-28",
  "2027-09-15",
  "2027-10-27",
  "2027-12-08",
];

// 한국은행 통화정책방향 결정회의. 한국은행 공식 일정표는 직접 못 읽어서 토스뱅크 정리본(2026-01)을 쓰고
// 기사로 2/26·7/16·8/27 회의를 교차 확인함 (2026-10-21). 2027년 일정이 나오면 추가할 것.
const BOK_DECISION_DATES = ["2026-10-22", "2026-11-26"];

// FRED 발표 일정 id → 이름. 다섯 발표 모두 미 동부 08:30 발표.
const FRED_RELEASES: { id: number; title: string }[] = [
  { id: 10, title: "CPI (소비자물가)" },
  { id: 50, title: "고용보고서 (비농업 고용·실업률)" },
  { id: 53, title: "GDP" },
  { id: 46, title: "PPI (생산자물가)" },
  { id: 9, title: "소매판매" },
];

const FF_COUNTRIES: Record<string, string> = {
  USD: "미국",
  EUR: "유럽",
  JPY: "일본",
  CNY: "중국",
  GBP: "영국",
  CAD: "캐나다",
  AUD: "호주",
  NZD: "뉴질랜드",
  CHF: "스위스",
  All: "전체",
};

// Forex Factory 제목 앞의 나라 이름 (유로존 안의 국가 지표)
const FF_PREFIXES: Record<string, string> = {
  "French ": "프랑스 ",
  "German ": "독일 ",
  "Italian ": "이탈리아 ",
  "Spanish ": "스페인 ",
};

// 자주 나오는 제목만 한글로. 없는 제목은 영어 그대로 보여 준다.
const FF_TITLES: Record<string, string> = {
  "CPI m/m": "CPI (전월비)",
  "CPI y/y": "CPI (전년비)",
  "CPI q/q": "CPI (전분기비)",
  "Core CPI m/m": "근원 CPI (전월비)",
  "Core CPI y/y": "근원 CPI (전년비)",
  "Median CPI y/y": "중위 CPI (전년비)",
  "Trimmed CPI y/y": "절사평균 CPI (전년비)",
  "Common CPI y/y": "공통 CPI (전년비)",
  "Tokyo Core CPI y/y": "도쿄 근원 CPI (전년비)",
  "National Core CPI y/y": "전국 근원 CPI (전년비)",
  "PPI m/m": "PPI (전월비)",
  "Core PPI m/m": "근원 PPI (전월비)",
  "Core PCE Price Index m/m": "근원 PCE (전월비)",
  "Non-Farm Employment Change": "비농업 고용",
  "ADP Non-Farm Employment Change": "ADP 민간 고용",
  "Unemployment Rate": "실업률",
  "Unemployment Claims": "신규 실업수당 청구",
  "Average Hourly Earnings m/m": "평균 시간당 임금 (전월비)",
  "Average Earnings Index 3m/y": "평균 임금 (3개월, 전년비)",
  "Employment Change": "고용 변화",
  "Claimant Count Change": "실업수당 청구 변화",
  "JOLTS Job Openings": "JOLTS 구인",
  "Retail Sales m/m": "소매판매 (전월비)",
  "Core Retail Sales m/m": "근원 소매판매 (전월비)",
  "Advance GDP q/q": "GDP 속보치 (전분기비)",
  "Prelim GDP q/q": "GDP 잠정치 (전분기비)",
  "Final GDP q/q": "GDP 확정치 (전분기비)",
  "GDP q/q": "GDP (전분기비)",
  "GDP y/y": "GDP (전년비)",
  "Industrial Production y/y": "산업생산 (전년비)",
  "Trade Balance": "무역수지",
  "Flash Manufacturing PMI": "제조업 PMI 예비치",
  "Flash Services PMI": "서비스업 PMI 예비치",
  "Manufacturing PMI": "제조업 PMI",
  "Services PMI": "서비스업 PMI",
  "ISM Manufacturing PMI": "ISM 제조업 PMI",
  "ISM Services PMI": "ISM 서비스업 PMI",
  "Caixin Manufacturing PMI": "차이신 제조업 PMI",
  "Caixin Services PMI": "차이신 서비스업 PMI",
  "Prelim UoM Consumer Sentiment": "미시간대 소비자심리 예비치",
  "Revised UoM Consumer Sentiment": "미시간대 소비자심리 확정치",
  "Prelim UoM Inflation Expectations": "미시간대 기대인플레이션 예비치",
  "Revised UoM Inflation Expectations": "미시간대 기대인플레이션 확정치",
  "CB Consumer Confidence": "콘퍼런스보드 소비자신뢰",
  "Ifo Business Climate": "Ifo 기업환경",
  "ZEW Economic Sentiment": "ZEW 경기기대",
  "Federal Funds Rate": "미국 기준금리 결정",
  "FOMC Statement": "FOMC 성명",
  "FOMC Press Conference": "FOMC 기자회견",
  "FOMC Meeting Minutes": "FOMC 의사록",
  "Main Refinancing Rate": "ECB 기준금리 결정",
  "ECB Press Conference": "ECB 기자회견",
  "BOJ Policy Rate": "일본은행 기준금리 결정",
  "BOJ Press Conference": "일본은행 기자회견",
  "Official Bank Rate": "영국 기준금리 결정",
  "Overnight Rate": "캐나다 기준금리 결정",
  "Cash Rate": "호주 기준금리 결정",
  "Official Cash Rate": "뉴질랜드 기준금리 결정",
  "SNB Policy Rate": "스위스 기준금리 결정",
  "Monetary Policy Statement": "통화정책 성명",
};

function translateTitle(title: string): string {
  for (const [prefix, korean] of Object.entries(FF_PREFIXES)) {
    if (title.startsWith(prefix)) return korean + translateTitle(title.slice(prefix.length));
  }
  if (FF_TITLES[title]) return FF_TITLES[title];
  if (title.endsWith(" Speaks")) return `${title.slice(0, -" Speaks".length)} 발언`;
  return title;
}

// 미 동부 시각 → ms. 서머타임이라 그날 뉴욕 시차(-4 또는 -5시간)를 Intl로 구한다.
function easternTime(date: string, hour: number, minute: number) {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")!.value; // 예: "GMT-4"
  const offsetHours = Number(offset.replace("GMT", ""));
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return Date.parse(`${date}T${hh}:${mm}:00Z`) - offsetHours * 3_600_000;
}

interface FfEvent {
  title: string;
  country: string;
  date: string; // 예: "2026-10-22T08:30:00-04:00"
  impact: string; // High · Medium · Low · Holiday
  forecast: string;
  previous: string;
}

// 이번 주 전체 일정과, 이 피드가 덮는 마지막 시각(그 뒤는 FRED·FOMC로 채움).
async function getForexFactoryWeek() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      next: { revalidate: 3600 },
    });
    const json: FfEvent[] = await res.json();
    if (!Array.isArray(json)) throw new Error(`HTTP ${res.status}`);
    const coveredUntil = Math.max(...json.map((e) => Date.parse(e.date)));
    const events: CalendarEvent[] = json
      .filter((e) => e.impact === "High" || e.impact === "Medium")
      .map((e) => ({
        time: Date.parse(e.date),
        hasTime: true,
        country: FF_COUNTRIES[e.country] ?? e.country,
        title: translateTitle(e.title),
        high: e.impact === "High",
        forecast: e.forecast || null,
        previous: e.previous || null,
      }));
    return { events, coveredUntil };
  } catch (error) {
    logEvent("error", "economic_calendar", "Forex Factory 일정 조회 실패", String(error));
    return { events: [], coveredUntil: 0 };
  }
}

async function getFredReleaseDates(id: number, from: string, to: string) {
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/release/dates?release_id=${id}&api_key=${process.env.FRED_API_KEY}` +
        `&file_type=json&include_release_dates_with_no_data=true&realtime_start=${from}&realtime_end=${to}&sort_order=asc`,
      { next: { revalidate: 3600 } },
    );
    const json = await res.json();
    const dates: { date: string }[] = json?.release_dates ?? [];
    return dates.map((d) => d.date).filter((date) => date >= from && date <= to);
  } catch (error) {
    logEvent("error", "economic_calendar", "FRED 발표 일정 조회 실패", `release=${id} ${error}`);
    return [];
  }
}

function kstDate(time: number) {
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 오늘(한국시간)부터 2주치, 시간순
export async function getEconomicCalendar(): Promise<CalendarEvent[]> {
  const now = Date.now();
  const from = kstDate(now);
  const to = kstDate(now + DAYS_AHEAD * DAY_MS);

  const [forexFactory, ...fredDates] = await Promise.all([
    getForexFactoryWeek(),
    ...FRED_RELEASES.map((release) => getFredReleaseDates(release.id, from, to)),
  ]);

  // 이번 주는 Forex Factory가 같은 미국 일정을 시각·예상치까지 줘서, 그 뒤만 FRED·FOMC로 채운다.
  const usLater: CalendarEvent[] = [
    ...FRED_RELEASES.flatMap((release, i) =>
      fredDates[i].map((date) => ({
        time: easternTime(date, 8, 30),
        hasTime: true,
        country: "미국",
        title: release.title,
        high: true,
        forecast: null,
        previous: null,
      })),
    ),
    ...FOMC_DECISION_DATES.map((date) => ({
      time: easternTime(date, 14, 0),
      hasTime: true,
      country: "미국",
      title: "FOMC 기준금리 결정",
      high: true,
      forecast: null,
      previous: null,
    })),
  ].filter((e) => e.time > forexFactory.coveredUntil);

  const korea: CalendarEvent[] = BOK_DECISION_DATES.map((date) => ({
    time: Date.parse(`${date}T00:00:00+09:00`),
    hasTime: false,
    country: "한국",
    title: "한국은행 기준금리 결정 (금통위)",
    high: true,
    forecast: null,
    previous: null,
  }));

  return [...forexFactory.events, ...usLater, ...korea]
    .filter((e) => kstDate(e.time) >= from && kstDate(e.time) <= to)
    .sort((a, b) => a.time - b.time);
}
