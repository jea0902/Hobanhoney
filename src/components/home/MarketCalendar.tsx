import { getEconomicCalendar } from "@/lib/economicCalendar";
import type { CalendarEvent } from "@/lib/economicCalendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 한국 방문자가 주로 보는 두 나라라 눈에 띄게 (사용자 요청)
const HIGHLIGHTED = ["미국", "한국"];

function kstParts(time: number) {
  const d = new Date(time + 9 * 3_600_000);
  return {
    date: d.toISOString().slice(0, 10),
    label: `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${WEEKDAYS[d.getUTCDay()]})`,
    clock: d.toISOString().slice(11, 16),
  };
}

export default async function MarketCalendar() {
  const events = await getEconomicCalendar();

  const days: { label: string; events: CalendarEvent[] }[] = [];
  let lastDate = "";
  for (const event of events) {
    const { date, label } = kstParts(event.time);
    if (date !== lastDate) days.push({ label, events: [] });
    days.at(-1)!.events.push(event);
    lastDate = date;
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-100">증시 캘린더</h2>
      {days.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          일정을 불러오지 못함
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto pr-1">
          {days.map((day) => (
            <div key={day.label} className="mb-3">
              <p className="sticky top-0 bg-white py-1 text-xs font-semibold text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                {day.label}
              </p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {day.events.map((event, i) => (
                  <EventRow key={`${event.time}-${event.title}-${i}`} event={event} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        한국시간 · ★★★ 중요 ★★ 보통 · 이번 주는 예상치·이전치 포함 · 결과는 미국만
        <br />
        출처: Forex Factory, FRED, 연준, 한국은행, 국가데이터처, ECB, 일본은행, 영란은행
      </p>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const highlighted = HIGHLIGHTED.includes(event.country);
  const badge =
    event.country === "한국"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : event.country === "미국"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  // 날짜만 있는 일정은 그날이 지나야 끝난 것으로 본다.
  const isPast = event.hasTime
    ? event.time < Date.now()
    : kstParts(event.time).date < kstParts(Date.now()).date;

  return (
    <li
      className={`flex items-start gap-2 py-2 ${isPast ? "opacity-50" : highlighted ? "" : "opacity-80"}`}
    >
      <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-gray-400">
        {event.hasTime ? kstParts(event.time).clock : "—"}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge}`}>
        {event.country}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${highlighted ? "font-bold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}
        >
          {event.title}
        </p>
        {(event.actual || event.forecast || event.previous) && (
          <p className="text-[11px] text-gray-400">
            {event.actual && (
              <span className="mr-1.5 font-bold text-gray-900 dark:text-gray-100">
                결과 {event.actual}
              </span>
            )}
            {event.forecast && `예상 ${event.forecast}`}
            {event.forecast && event.previous && " · "}
            {event.previous && `이전 ${event.previous}`}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 pt-0.5 text-[11px] ${event.high ? "text-amber-500" : "text-gray-300 dark:text-gray-600"}`}
      >
        {event.high ? "★★★" : "★★"}
      </span>
    </li>
  );
}
