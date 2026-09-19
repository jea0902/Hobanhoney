"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { logEvent } from "@/lib/logger";

function getFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function addRanker(formData: FormData) {
  const supabase = getSupabase();
  const walletAddress = getFormValue(formData, "wallet_address");
  const note = getFormValue(formData, "note") || null;

  const { error } = await supabase.from("rankers").insert({ wallet_address: walletAddress, note });

  if (error) {
    logEvent("error", "admin", "랭커 추가 실패", `address=${walletAddress} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "랭커 추가", `address=${walletAddress}`);
  redirect("/admin/rankers");
}

export async function deleteRanker(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("rankers").delete().eq("id", id);

  if (error) {
    logEvent("error", "admin", "랭커 삭제 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "랭커 삭제", `id=${id}`);
  redirect("/admin/rankers");
}
