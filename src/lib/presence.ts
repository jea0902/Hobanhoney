"use server";

import { getSupabase } from "@/lib/supabase";

// "현재 접속 중"으로 볼 시간 창. AutoRefresh가 10초마다 핑을 보내므로 2배 여유를 둔다.
const ONLINE_WINDOW_MS = 20_000;

export async function pingPresence(sessionId: string) {
  const supabase = getSupabase();
  await supabase
    .from("presence")
    .upsert({ session_id: sessionId, last_seen: new Date().toISOString() });

  // 핑 올 때마다 오래된 세션도 같이 정리해서, 접속자 수 집계용 테이블이 계속 불어나지 않게 한다.
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase.from("presence").delete().lt("last_seen", staleCutoff);
}

export async function getOnlineCount() {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("presence")
    .select("*", { count: "exact", head: true })
    .gte("last_seen", cutoff);
  return count ?? 0;
}
