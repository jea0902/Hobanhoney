import { getSupabase } from "@/lib/supabase";

type LogLevel = "error" | "info";

// Vercel 무료 플랜은 런타임 로그를 오래 안 남겨서, 의미 있는 이벤트는 Supabase에 직접 기록한다.
// 로그 저장 자체가 실패해도 앱 동작에는 영향 주면 안 되므로 조용히 무시한다.
export async function logEvent(level: LogLevel, source: string, message: string, detail?: string) {
  try {
    const supabase = getSupabase();
    await supabase.from("logs").insert({
      level,
      source,
      message,
      detail: detail ?? null,
    });
  } catch {
    // ignore
  }
}
