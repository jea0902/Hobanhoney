import { logEvent } from "@/lib/logger";

// 증시 캘린더 (TODO.md 21번). 한 출처로 다 되는 무료 API가 없어서 세 가지를 합친다.
// - 이번 주 세계 일정: Forex Factory 주간 피드 (비공식, 이번 주만, 한국 없음, 예상치·이전치 있음)
// - 다음 주 이후 미국 일정: FRED 발표 일정 + 연준 공식 FOMC 일정 페이지 (날짜만 줘서 공식 발표 시각을 붙임)
// - 한국: 한국은행 공식 금통위 일정 페이지
// FOMC·금통위는 API가 없어 공식 페이지를 읽는다. 일정은 1년 단위로 미리 공개되고 자주 안 바뀌어서 하루 캐시.
// 인베스팅닷컴은 서버 요청을 403으로 막아서 쓰지 않음 (2026-10-21 확인).

export interface CalendarEvent {
  time: number; // 발표 시각 (ms). hasTime이 false면 그날 한국시간 0시
  hasTime: boolean;
  country: string; // 한글 국가·지역 이름
  title: string;
  high: boolean; // 중요도 높음 (아니면 중간)
  forecast: string | null;
  previous: string | null;
  actual: string | null; // 발표 뒤 결과 (지금은 미국만 — FRED)
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
const DAYS_AHEAD = 14;
// 발표 결과를 1~2일 보여 주려고 지난 일정도 이만큼 남긴다 (사용자 요청).
const DAYS_BEHIND = 2;

const SCHEDULE_REVALIDATE_SECONDS = 86_400;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// FRED 발표 일정 id → 이름. 다섯 발표 모두 미 동부 08:30 발표.
// 이름은 Forex Factory 제목의 한글 이름과 맞춰서 아래 US_ACTUALS로 결과를 같이 찾는다.
const FRED_RELEASES: { id: number; title: string }[] = [
  { id: 10, title: "CPI (전년비)" },
  { id: 50, title: "비농업 고용" },
  { id: 53, title: "GDP (전분기비 연율)" },
  { id: 46, title: "PPI (전월비)" },
  { id: 9, title: "소매판매 (전월비)" },
];

// 미국 지표 결과: 한글 제목 → FRED 시리즈. units는 FRED 변환(pch 전월비, pc1 전년비, chg 증감, lin 그대로).
const percent = (v: number) => `${v.toFixed(1)}%`;
const thousands = (v: number) => `${Math.round(v)}K`;
const US_ACTUALS: Record<string, { series: string; units: string; format: (v: number) => string }> =
  {
    "CPI (전월비)": { series: "CPIAUCSL", units: "pch", format: percent },
    "CPI (전년비)": { series: "CPIAUCSL", units: "pc1", format: percent },
    "근원 CPI (전월비)": { series: "CPILFESL", units: "pch", format: percent },
    "근원 CPI (전년비)": { series: "CPILFESL", units: "pc1", format: percent },
    "비농업 고용": { series: "PAYEMS", units: "chg", format: thousands },
    실업률: { series: "UNRATE", units: "lin", format: percent },
    "신규 실업수당 청구": { series: "ICSA", units: "lin", format: (v) => thousands(v / 1000) },
    "소매판매 (전월비)": { series: "RSAFS", units: "pch", format: percent },
    "PPI (전월비)": { series: "PPIFIS", units: "pch", format: percent },
    "GDP (전분기비 연율)": { series: "A191RL1Q225SBEA", units: "lin", format: percent },
    "GDP 속보치 (전분기비)": { series: "A191RL1Q225SBEA", units: "lin", format: percent },
    "GDP 잠정치 (전분기비)": { series: "A191RL1Q225SBEA", units: "lin", format: percent },
    "GDP 확정치 (전분기비)": { series: "A191RL1Q225SBEA", units: "lin", format: percent },
  };

// 국가데이터처 월간 보도계획에서 고르는 한국 지표 (보도자료명 "2026년 10월 소비자물가동향"의 뒷부분)
const KOSTAT_TITLES: Record<string, string> = {
  소비자물가동향: "소비자물가 (전년비)",
  고용동향: "고용동향",
  산업활동동향: "산업활동동향 (생산·소비·투자)",
};

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
  "1-y Loan Prime Rate": "중국 1년 LPR",
  "5-y Loan Prime Rate": "중국 5년 LPR",
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

// 이번 주 전체 일정과, 이 피드가 덮는 기간(그 밖은 공식 일정으로 채움).
async function getForexFactoryWeek() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      next: { revalidate: 3600 },
    });
    const json: FfEvent[] = await res.json();
    if (!Array.isArray(json)) throw new Error(`HTTP ${res.status}`);
    const times = json.map((e) => Date.parse(e.date));
    const covered = { from: Math.min(...times), until: Math.max(...times) };
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
        actual: null,
      }));
    return { events, covered };
  } catch (error) {
    logEvent("error", "economic_calendar", "Forex Factory 일정 조회 실패", String(error));
    return { events: [], covered: { from: 0, until: 0 } };
  }
}

function easternDate(time: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(time);
}

// 그 발표의 결과. FRED 시리즈가 마지막으로 갱신된 날(vintage)이 발표일(미 동부)과 같을 때만 —
// 아니면 아직 반영 전이라 지난 달 값을 이번 결과로 잘못 보여 주게 된다.
async function getUsActual(title: string, time: number) {
  const spec = US_ACTUALS[title];
  if (!spec || time > Date.now()) return null;
  const base = `https://api.stlouisfed.org/fred/series`;
  const key = `api_key=${process.env.FRED_API_KEY}&file_type=json`;
  try {
    const [vintages, observations] = await Promise.all(
      [
        `${base}/vintagedates?series_id=${spec.series}&${key}&sort_order=desc&limit=1`,
        `${base}/observations?series_id=${spec.series}&${key}&sort_order=desc&limit=1&units=${spec.units}`,
      ].map((url) => fetch(url, { next: { revalidate: 3600 } }).then((res) => res.json())),
    );
    if (vintages?.vintage_dates?.[0] !== easternDate(time)) return null;
    const value = Number(observations?.observations?.[0]?.value);
    return Number.isNaN(value) ? null : spec.format(value);
  } catch (error) {
    logEvent("error", "economic_calendar", "FRED 결과 조회 실패", `${spec.series} ${error}`);
    return null;
  }
}

// 한국은행 ECOS 시계열 (통계코드·항목코드는 ECOS StatisticTableList·StatisticItemList로 확인, 2026-10-21).
// 시점("202609") → 값.
async function getEcosSeries(stat: string, cycle: string, from: string, to: string, item: string) {
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${process.env.ECOS_API_KEY}/json/kr/1/100/${stat}/${cycle}/${from}/${to}/${item}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = await res.json();
    const rows: { TIME: string; DATA_VALUE: string }[] = json?.StatisticSearch?.row ?? [];
    return new Map(rows.map((row) => [row.TIME, Number(row.DATA_VALUE)]));
  } catch (error) {
    logEvent("error", "economic_calendar", "ECOS 조회 실패", `${stat}/${item} ${error}`);
    return new Map<string, number>();
  }
}

function yearAgo(yyyymm: string) {
  return `${Number(yyyymm.slice(0, 4)) - 1}${yyyymm.slice(4)}`;
}

// 보도자료의 기준 달(예: "202610")이 ECOS에 들어온 뒤에만 결과를 만든다. 발표 당일 ECOS 반영이 늦으면
// 그동안은 결과 없이 보이고, 지난달 값을 이번 결과로 잘못 보여 주지는 않는다.
async function getKoreaActual(name: string, refMonth: string) {
  if (name === "소비자물가동향") {
    const cpi = await getEcosSeries("901Y009", "M", yearAgo(refMonth), refMonth, "0");
    const now = cpi.get(refMonth);
    const before = cpi.get(yearAgo(refMonth));
    return now && before ? `${((now / before - 1) * 100).toFixed(1)}%` : null;
  }
  if (name === "고용동향") {
    const [employed, unemployment] = await Promise.all([
      getEcosSeries("901Y027", "M", yearAgo(refMonth), refMonth, "I61BA/I28A"),
      getEcosSeries("901Y027", "M", refMonth, refMonth, "I61BC/I28A"),
    ]);
    const now = employed.get(refMonth);
    const before = employed.get(yearAgo(refMonth));
    const rate = unemployment.get(refMonth);
    if (!now || !before || rate === undefined) return null;
    // 취업자는 천 명 단위, 보도자료처럼 전년 같은 달 대비 증감. 이 표는 원계열(I28A)·계절조정(I28B)이 같이 있어서
    // 보도자료 첫 줄과 같은 원계열을 고른다 (안 고르면 계절조정 값이 섞임).
    const change = (now - before) / 10;
    return `취업자 ${change >= 0 ? "+" : ""}${change.toFixed(1)}만 명 · 실업률 ${rate.toFixed(1)}%`;
  }
  return null;
}

// 국가데이터처 월간 보도계획 표: "11.03.( 화 ) | 08:00 | 2026년 10월 소비자물가동향". 그해 보도계획만 있어서
// 연말에 다음 해 1월은 못 읽는다 (새해 계획이 올라오면 그때부터 보임).
async function getKostatEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const url = `https://mods.go.kr/newsPln.es?mid=a10305000000&oa_mm=${String(month).padStart(2, "0")}&act=list`;
  try {
    const res = await fetch(url, { next: { revalidate: SCHEDULE_REVALIDATE_SECONDS } });
    const html = await res.text();
    if (!html.includes(`${year}년 ${month}월 보도계획`))
      throw new Error(`HTTP ${res.status}, 표 없음`);
    const text = pageText(html.replace(/<\/td>/g, " | "));
    const rows = [
      ...text.matchAll(
        /(\d{2})\.(\d{2})\.\( . \) \| (\d{2}:\d{2}) \| (\d{4})년 (\d{1,2})월 (소비자물가동향|고용동향|산업활동동향) \|/g,
      ),
    ];
    return await Promise.all(
      rows.map(async ([, mm, dd, clock, refYear, refMonth, name]) => {
        const time = Date.parse(`${year}-${mm}-${dd}T${clock}:00+09:00`);
        const ref = `${refYear}${refMonth.padStart(2, "0")}`;
        return {
          time,
          hasTime: true,
          country: "한국",
          title: KOSTAT_TITLES[name],
          high: true,
          forecast: null,
          previous: null,
          actual: time <= Date.now() ? await getKoreaActual(name, ref) : null,
        };
      }),
    );
  } catch (error) {
    logEvent("error", "economic_calendar", "국가데이터처 보도계획 조회 실패", `${url} ${error}`);
    return [];
  }
}

// 관세청 수출입 현황 잠정치: 매월 11일(1~10일분)·21일(1~20일분), 휴일이면 다음 근무일 (기사로 확인, 2026-10-21).
// 한국 공휴일 데이터가 아직 없어 주말만 피한다 — 공휴일이면 날짜가 틀릴 수 있어 "추정"으로 표시 (TODO 21번).
function customsEvents(months: string[]): CalendarEvent[] {
  return months.flatMap((month) =>
    [
      { day: "11", title: "수출입 현황 (1~10일 잠정치, 날짜 추정)" },
      { day: "21", title: "수출입 현황 (1~20일 잠정치, 날짜 추정)" },
    ].map(({ day, title }) => {
      let date = `${month}-${day}`;
      while ([0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()))
        date = new Date(Date.parse(date) + DAY_MS).toISOString().slice(0, 10);
      return dateOnlyEvent(date, "한국", title);
    }),
  );
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

// 중앙은행 공식 일정 페이지를 읽어 결정일("2026-10-28") 목록으로. API가 없어 HTML을 읽으므로,
// 페이지 구조가 바뀌어 하나도 못 찾으면 관리자 로그에 남긴다.
async function getSchedulePage(name: string, url: string, parse: (html: string) => string[]) {
  try {
    const res = await fetch(url, { next: { revalidate: SCHEDULE_REVALIDATE_SECONDS } });
    const dates = parse(await res.text());
    if (dates.length === 0) throw new Error(`HTTP ${res.status}, 회의 날짜를 못 찾음`);
    return dates;
  } catch (error) {
    logEvent("error", "economic_calendar", `${name} 일정 조회 실패`, `${url} ${error}`);
    return [];
  }
}

function isoDate(year: string | number, month: number, day: string | number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// "Sept", "Oct." 같은 줄임말도 앞 세 글자로 찾는다.
function monthNumber(text: string) {
  return MONTHS.findIndex((m) => m.slice(0, 3) === text.slice(0, 3)) + 1;
}

// 태그를 지운 본문 텍스트
function pageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

// 연도마다 "2026 FOMC Meetings" 제목 아래 월("January", 걸치면 "April/May")과 날짜("27-28")가 한 줄씩.
// 결정은 회의 둘째 날.
function parseFomc(html: string) {
  const dates: string[] = [];
  const sections = html.split(/(\d{4}) FOMC Meetings/);
  for (let i = 1; i < sections.length; i += 2) {
    const meetings = sections[i + 1].matchAll(
      /fomc-meeting__month[^>]*><strong>([A-Za-z/]+)<\/strong><\/div>\s*<div class="fomc-meeting__date[^>]*>\d+-(\d+)/g,
    );
    for (const [, monthText, lastDay] of meetings) {
      // "April/May 30-1"이면 둘째 날은 뒤쪽 달
      const month = monthNumber(monthText.split("/").at(-1)!);
      if (month > 0) dates.push(isoDate(sections[i], month, lastDay));
    }
  }
  return dates;
}

// 연도별 페이지에 "10월 22일(목)" 모양으로 회의 날짜가 있고, 그해 일정 전체가 미리 올라와 있다
// (2026-10-21 확인: 아직 안 열린 10/22·11/26도 있음, 2027년 페이지는 아직 비어 있음).
function parseBok(year: number) {
  return (html: string) => {
    // 연도 선택 목록 아래 회의 표만 본다.
    const table = html.slice(html.indexOf(`<h3>${year}년</h3>`));
    return [...table.matchAll(/(\d{2})월 (\d{2})일\(.\)/g)].map(([, month, day]) =>
      isoDate(year, Number(month), day),
    );
  };
}

// "29/10/2026 Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2)" — 둘째 날이 결정일.
// 통화정책이 아닌 회의(non-monetary policy meeting)는 이 문구가 달라서 안 걸린다.
function parseEcb(html: string) {
  return [
    ...pageText(html).matchAll(
      /(\d{2})\/(\d{2})\/(\d{4}) Governing Council of the ECB: monetary policy meeting[^(]*\(Day 2\)/g,
    ),
  ].map(([, day, month, year]) => isoDate(year, Number(month), day));
}

// 연도별 표("Table : 2026") 각 줄의 첫 칸이 회의 날짜: "Oct. 29 (Thurs.), 30 (Fri.)". 결정은 둘째 날.
function parseBoj(html: string) {
  const dates: string[] = [];
  for (const table of html.split("<table").slice(1)) {
    const year = table.match(/Table : (\d{4})/)?.[1];
    if (!year) continue;
    for (const [, cell] of table.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>/g)) {
      const text = pageText(cell);
      // 둘째 날이 다음 달로 넘어가면 "Apr. 30 (Thurs.), May 1 (Fri.)"처럼 달이 한 번 더 나온다.
      const match = text.match(/^\s*([A-Za-z]+)\.? \d+ \([^)]*\), (?:([A-Za-z]+)\.? )?(\d+)/);
      if (!match) continue;
      const month = monthNumber(match[2] ?? match[1]);
      if (month > 0) dates.push(isoDate(year, month, match[3]));
    }
  }
  return dates;
}

// "2026 confirmed dates" 아래 "Thursday 5 November" 모양 (금리 발표일).
function parseBoe(html: string) {
  const dates: string[] = [];
  const sections = pageText(html).split(/(\d{4}) confirmed dates/);
  for (let i = 1; i < sections.length; i += 2) {
    for (const [, day, monthText] of sections[i + 1].matchAll(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday) (\d{1,2}) ([A-Z][a-z]+)/g,
    )) {
      const month = monthNumber(monthText);
      if (month > 0) dates.push(isoDate(sections[i], month, day));
    }
  }
  return dates;
}

function kstDate(time: number) {
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 중국 공휴일·대체근무일. 국무원 공고를 연도별 JSON으로 옮긴 GitHub 프로젝트(NateScarlet/holiday-cn, 비공식)
// — 공식 기계 판독용 출처를 못 찾아 사용자 승인 후 사용 (2026-10-21). 날짜 → 쉬는 날이면 true, 대체근무일이면 false.
async function getChinaHolidays(year: number) {
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
      {
        next: { revalidate: SCHEDULE_REVALIDATE_SECONDS },
      },
    );
    const json: { days: { date: string; isOffDay: boolean }[] } = await res.json();
    if (!Array.isArray(json?.days) || json.days.length === 0) throw new Error(`HTTP ${res.status}`);
    return new Map(json.days.map((d) => [d.date, d.isOffDay]));
  } catch (error) {
    // 그해 공고가 아직 없을 수도 있어서(보통 전년 11~12월 발표) 주말만 피하는 계산으로 대신한다.
    logEvent("error", "economic_calendar", "중국 휴일 데이터 조회 실패", `${year} ${error}`);
    return null;
  }
}

// LPR은 매월 20일 9:30(베이징) 발표, 휴일이면 다음 영업일 (인민은행 2019년 공고). 중국 휴일 데이터로 계산한
// 날짜가 chinamoney 실제 발표일 최근 1년 12번과 모두 일치함 (2026-10-21 확인, 춘절·대체근무일 포함).
function lprEvents(months: string[], holidays: Map<number, Map<string, boolean> | null>) {
  return months.map((month) => {
    const calendar = holidays.get(Number(month.slice(0, 4))) ?? null;
    let date = `${month}-20`;
    const isWorkday = (d: string) => {
      const off = calendar?.get(d);
      if (off !== undefined) return !off;
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      return weekday !== 0 && weekday !== 6;
    };
    while (!isWorkday(date)) date = new Date(Date.parse(date) + DAY_MS).toISOString().slice(0, 10);
    return {
      time: Date.parse(`${date}T09:30:00+08:00`),
      hasTime: true,
      country: "중국",
      title: calendar
        ? "중국 LPR 발표 (기준금리)"
        : "중국 LPR 발표 (기준금리, 휴일 미반영 날짜 추정)",
      high: true,
      forecast: null,
      previous: null,
      actual: null,
    };
  });
}

// 발표 시각을 공식 페이지에서 확인하지 못한 결정일은 날짜만 보여 준다.
function dateOnlyEvent(date: string, country: string, title: string): CalendarEvent {
  return {
    time: Date.parse(`${date}T00:00:00+09:00`),
    hasTime: false,
    country,
    title,
    high: true,
    forecast: null,
    previous: null,
    actual: null,
  };
}

// 이틀 전(한국시간)부터 2주 뒤까지, 시간순. 지난 일정은 결과를 보여 주려고 남긴다.
export async function getEconomicCalendar(): Promise<CalendarEvent[]> {
  const now = Date.now();
  const from = kstDate(now - DAYS_BEHIND * DAY_MS);
  const to = kstDate(now + DAYS_AHEAD * DAY_MS);

  // 2주 범위가 연말을 넘을 수 있어 금통위는 올해·내년 페이지를 같이 본다 (내년은 비어 있을 수 있음).
  const year = Number(kstDate(now).slice(0, 4));
  const bokUrl = (y: number) =>
    `https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755&pYear=${y}`;
  // 범위가 걸치는 달들 (매월 정해진 날에 나오는 LPR·관세청 잠정치·국가데이터처 보도계획용)
  const months = [...new Set([from.slice(0, 7), kstDate(now).slice(0, 7), to.slice(0, 7)])];
  const monthYears = [...new Set(months.map((m) => Number(m.slice(0, 4))))];
  const [forexFactory, fomc, bok, bokNextYear, ecb, boj, boe, chinaHolidays, kostat, ...fredDates] =
    await Promise.all([
      getForexFactoryWeek(),
      getSchedulePage(
        "FOMC",
        "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        parseFomc,
      ),
      getSchedulePage("금통위", bokUrl(year), parseBok(year)),
      fetch(bokUrl(year + 1), { next: { revalidate: SCHEDULE_REVALIDATE_SECONDS } })
        .then(async (res) => parseBok(year + 1)(await res.text()))
        .catch(() => []),
      getSchedulePage(
        "ECB",
        "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
        parseEcb,
      ),
      getSchedulePage("일본은행", "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm", parseBoj),
      getSchedulePage(
        "영란은행",
        "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates",
        parseBoe,
      ),
      Promise.all(monthYears.map(getChinaHolidays)),
      // 보도계획은 올해 것만 있어서 다음 해 달은 건너뛴다.
      Promise.all(
        months
          .filter((m) => Number(m.slice(0, 4)) === year)
          .map((m) => getKostatEvents(year, Number(m.slice(5, 7)))),
      ),
      ...FRED_RELEASES.map((release) => getFredReleaseDates(release.id, from, to)),
    ]);

  // Forex Factory가 덮는 이번 주는 같은 일정을 시각·예상치까지 줘서, 그 밖만 공식 일정으로 채운다.
  // 한국은 Forex Factory에 없어서 항상 공식 일정으로.
  const outsideForexFactory = (e: CalendarEvent) =>
    e.time < forexFactory.covered.from || e.time > forexFactory.covered.until;
  const official: CalendarEvent[] = [
    ...FRED_RELEASES.flatMap((release, i) =>
      fredDates[i].map((date) => ({
        time: easternTime(date, 8, 30),
        hasTime: true,
        country: "미국",
        title: release.title,
        high: true,
        forecast: null,
        previous: null,
        actual: null,
      })),
    ),
    ...fomc.map((date) => ({
      time: easternTime(date, 14, 0),
      hasTime: true,
      country: "미국",
      title: "FOMC 기준금리 결정",
      high: true,
      forecast: null,
      previous: null,
      actual: null,
    })),
    ...ecb.map((date) => dateOnlyEvent(date, "유럽", "ECB 기준금리 결정")),
    ...boj.map((date) => dateOnlyEvent(date, "일본", "일본은행 기준금리 결정")),
    ...boe.map((date) => dateOnlyEvent(date, "영국", "영국 기준금리 결정")),
    ...lprEvents(months, new Map(monthYears.map((y, i) => [y, chinaHolidays[i]]))),
  ].filter(outsideForexFactory);

  const korea = [
    ...[...bok, ...bokNextYear].map((date) =>
      dateOnlyEvent(date, "한국", "한국은행 기준금리 결정 (금통위)"),
    ),
    ...kostat.flat(),
    ...customsEvents(months),
  ];

  const events = [...forexFactory.events, ...official, ...korea]
    .filter((e) => kstDate(e.time) >= from && kstDate(e.time) <= to)
    .sort((a, b) => a.time - b.time);

  // 이미 발표된 미국 지표에 결과를 붙인다.
  await Promise.all(
    events
      .filter((e) => e.country === "미국")
      .map(async (e) => {
        e.actual = await getUsActual(e.title, e.time);
      }),
  );
  return events;
}
