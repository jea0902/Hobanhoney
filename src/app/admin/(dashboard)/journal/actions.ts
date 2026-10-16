"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { logEvent } from "@/lib/logger";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

export async function saveJournalReasons(id: string, formData: FormData) {
  const { error } = await getSupabase()
    .from("trade_journal")
    .update({
      entry_reason: getText(formData, "entry_reason"),
      exit_reason: getText(formData, "exit_reason"),
    })
    .eq("id", id);
  if (error) {
    logEvent("error", "admin", "매매일지 저장 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  redirect("/admin/journal");
}
