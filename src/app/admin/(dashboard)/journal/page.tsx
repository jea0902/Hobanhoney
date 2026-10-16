import { getJournalEntries, syncTradeJournal } from "@/lib/tradeJournal";
import { displaySymbol } from "@/lib/symbol";
import { saveJournalReasons } from "./actions";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500";

function formatKst(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function JournalAdminPage() {
  // 페이지를 열 때마다 Bybit 열린 포지션과 맞춰서, 새로 진입한 포지션이 바로 항목으로 생긴다.
  await syncTradeJournal();
  const entries = await getJournalEntries();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">매매일지</h1>
        <p className="mt-1 text-xs text-gray-400">
          진입하면 날짜·종목·포지션·비중이 자동 기록됨 (이 페이지를 열 때와 6시간마다 Bybit와
          동기화). 그 사이에 열었다 닫은 짧은 포지션은 기록되지 않음.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
          아직 기록된 매매 없음.
        </p>
      )}

      {entries.map((entry) => {
        const isLong = entry.direction === "Long";
        const needsExitReason = entry.closed_at !== null && !entry.exit_reason;
        return (
          <form
            key={entry.id}
            action={saveJournalReasons.bind(null, entry.id)}
            className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {displaySymbol(entry.symbol)}
                </span>
                <span className={`text-sm font-bold ${isLong ? "text-red-500" : "text-blue-500"}`}>
                  {entry.direction}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {entry.position_value.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  entry.closed_at
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    : "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                }`}
              >
                {entry.closed_at ? "종료" : "진행 중"}
              </span>
            </div>
            <p className="-mt-2 text-xs text-gray-400">
              진입 {formatKst(entry.opened_at)}
              {entry.closed_at && ` · 종료 확인 ${formatKst(entry.closed_at)}`}
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                진입 근거
              </span>
              <textarea
                name="entry_reason"
                defaultValue={entry.entry_reason ?? ""}
                rows={3}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span
                className={`text-xs font-medium ${needsExitReason ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}
              >
                종료 근거{needsExitReason && " (종료됨 — 작성 필요)"}
              </span>
              <textarea
                name="exit_reason"
                defaultValue={entry.exit_reason ?? ""}
                rows={3}
                className={INPUT_CLASS}
              />
            </label>

            <button
              type="submit"
              className="self-end rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white"
            >
              저장
            </button>
          </form>
        );
      })}
    </div>
  );
}
