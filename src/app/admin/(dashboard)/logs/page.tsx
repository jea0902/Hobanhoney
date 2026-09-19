import { getSupabase } from "@/lib/supabase";
import { clearLogs } from "./actions";

export const dynamic = "force-dynamic";

interface LogRow {
  id: string;
  level: "error" | "info";
  source: string;
  message: string;
  detail: string | null;
  created_at: string;
}

export default async function LogsPage() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (data ?? []) as LogRow[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">로그 (최근 200개)</h1>
        <form action={clearLogs}>
          <button type="submit" className="text-sm font-medium text-red-500 underline">
            모두 지우기
          </button>
        </form>
      </div>

      {logs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
          아직 기록된 로그가 없어요.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="rounded-xl border border-gray-100 bg-white p-3 text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  log.level === "error" ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"
                }`}
              >
                {log.level === "error" ? "ERROR" : "INFO"}
              </span>
              <span className="text-xs font-medium text-gray-400">{log.source}</span>
              <span className="ml-auto shrink-0 text-xs text-gray-400">
                {new Date(log.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <p className="mt-1 font-medium text-gray-900">{log.message}</p>
            {log.detail && <p className="mt-0.5 text-xs text-gray-500">{log.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
