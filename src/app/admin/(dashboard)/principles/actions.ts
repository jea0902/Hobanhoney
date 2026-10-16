"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { logEvent } from "@/lib/logger";

function getContent(formData: FormData) {
  return String(formData.get("content") ?? "").trim();
}

export async function addNote(kind: "principle" | "strategy", formData: FormData) {
  const content = getContent(formData);
  if (!content) redirect("/admin/principles");

  const { error } = await getSupabase().from("founder_notes").insert({ kind, content });
  if (error) {
    logEvent("error", "admin", "매매원칙·전략 추가 실패", error.message);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "매매원칙·전략 추가", `${kind}: ${content}`);
  redirect("/admin/principles");
}

export async function updateNote(id: string, formData: FormData) {
  const content = getContent(formData);
  if (!content) redirect("/admin/principles");

  const { error } = await getSupabase().from("founder_notes").update({ content }).eq("id", id);
  if (error) {
    logEvent("error", "admin", "매매원칙·전략 수정 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "매매원칙·전략 수정", `id=${id} ${content}`);
  redirect("/admin/principles");
}

export async function deleteNote(id: string) {
  const { error } = await getSupabase().from("founder_notes").delete().eq("id", id);
  if (error) {
    logEvent("error", "admin", "매매원칙·전략 삭제 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "매매원칙·전략 삭제", `id=${id}`);
  redirect("/admin/principles");
}
