"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export async function clearLogs() {
  const supabase = getSupabase();
  // 전체 삭제: uuid는 전부 이 조건을 만족하므로 사실상 전체 삭제 필터.
  await supabase.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  redirect("/admin/logs");
}
