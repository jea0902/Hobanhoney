import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { clearLogs } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface LogRow {
  id: string;
  level: "error" | "info";
  source: string;
  message: string;
  detail: string | null;
  created_at: string;
}

export default async function LogsPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = getSupabase();
  const { data, count } = await supabase
    .from("logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const logs = (data ?? []) as LogRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          로그 (전체 {totalCount}개)
        </h1>
        <form action={clearLogs}>
          <button type="submit" className="text-sm font-medium text-red-500 underline">
            모두 지우기
          </button>
        </form>
      </div>

      {logs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
          아직 기록된 로그가 없어요.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="rounded-xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  log.level === "error"
                    ? "bg-red-50 text-red-500 dark:bg-red-500/10"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {log.level === "error" ? "ERROR" : "INFO"}
              </span>
              <span className="text-xs font-medium text-gray-400">{log.source}</span>
              <span className="ml-auto shrink-0 text-xs text-gray-400">
                {new Date(log.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{log.message}</p>
            {log.detail && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{log.detail}</p>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <PageLink page={page - 1} disabled={page <= 1} label="이전" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages} label="다음" />
        </div>
      )}
    </div>
  );
}

function PageLink({ page, disabled, label }: { page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-300 dark:border-gray-800 dark:text-gray-700">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/logs?page=${page}`}
      className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {label}
    </Link>
  );
}
