import Link from "next/link";
import { getEconomicCalendar } from "@/lib/economicCalendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

// 한국시간 기준 날짜 번호 (날짜끼리 비교·뺄셈용)
function kstDay(time: number) {
  return Math.floor((time + KST_OFFSET_MS) / DAY_MS);
}

function dayLabel(time: number) {
  const diff = kstDay(time) - kstDay(Date.now());
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  const d = new Date(time + KST_OFFSET_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
}

// 홈에는 가장 가까운 중요(★★★) 일정 3개만. 전체 일정은 이벤트 메뉴에 있다.
export default async function UpcomingEvents() {
  const events = await getEconomicCalendar();
  const now = Date.now();
  const upcoming = events
    .filter((e) => e.high && (e.hasTime ? e.time >= now : kstDay(e.time) >= kstDay(now)))
    .slice(0, 3);

  return (
    <section className="px-6 pt-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-gray-200 px-4 py-2 text-xs dark:border-gray-800">
        <span className="font-bold text-gray-900 dark:text-gray-100">이벤트 전</span>
        {upcoming.length === 0 ? (
          <span className="text-gray-400">가까운 중요 일정 없음</span>
        ) : (
          upcoming.map((event) => (
            <span key={`${event.time}-${event.title}`} className="text-gray-700 dark:text-gray-300">
              <span className="text-gray-400">
                {dayLabel(event.time)}
                {event.hasTime &&
                  ` ${new Date(event.time + KST_OFFSET_MS).toISOString().slice(11, 16)}`}
              </span>{" "}
              {/* 제목이 이미 나라 이름으로 시작하면(예: 영국 기준금리 결정) 다시 붙이지 않음 */}
              {event.title.startsWith(event.country)
                ? event.title
                : `${event.country} ${event.title}`}
            </span>
          ))
        )}
        <Link
          href="/events"
          className="ml-auto text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          전체 보기 ›
        </Link>
      </div>
    </section>
  );
}
