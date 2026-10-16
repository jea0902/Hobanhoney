"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getMarkPrice } from "@/lib/bybit";
import { getUnrealizedPnl, getReturnRatePercent, getResult } from "@/lib/positionMath";
import { logEvent } from "@/lib/logger";
import type { PositionRow } from "@/types/position";

const ADMIN_SESSION_COOKIE = "admin_session";

export async function login(formData: FormData) {
  const password = formData.get("password");

  if (password !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login?error=1");
  }

  cookies().set(ADMIN_SESSION_COOKIE, process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/admin");
}

export async function logout() {
  cookies().delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

function getFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

// 결과는 수정 폼 안의 필드 하나라서, 다른 값과 같이 저장된다.
function resultFieldsFromForm(formData: FormData) {
  const result = getFormValue(formData, "result") || null;
  return {
    result,
    result_note: getFormValue(formData, "result_note") || null,
    result_recorded_at: result ? new Date().toISOString() : null,
  };
}

function editablePositionFieldsFromForm(formData: FormData) {
  return {
    trader_image: getFormValue(formData, "trader_image") || null,
    symbol: getFormValue(formData, "symbol"),
    direction: getFormValue(formData, "direction"),
    leverage: Number(getFormValue(formData, "leverage")),
    quantity: Number(getFormValue(formData, "quantity")),
    entry_price: Number(getFormValue(formData, "entry_price")),
    liquidation_price: Number(getFormValue(formData, "liquidation_price")),
    ...resultFieldsFromForm(formData),
  };
}

function editableStatementFieldsFromForm(formData: FormData) {
  return {
    trader_image: getFormValue(formData, "trader_image") || null,
    quote: getFormValue(formData, "quote"),
    direction: getFormValue(formData, "direction"),
    ...resultFieldsFromForm(formData),
  };
}

export async function createPosition(formData: FormData) {
  const supabase = getSupabase();
  const traderName = getFormValue(formData, "trader_name");
  const { error } = await supabase.from("positions").insert({
    type: "actual",
    trader_name: traderName,
    ...editablePositionFieldsFromForm(formData),
  });

  if (error) {
    logEvent("error", "admin", "실제 포지션 생성 실패", `trader=${traderName} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "실제 포지션 생성", `trader=${traderName}`);
  redirect("/admin");
}

export async function createStatement(formData: FormData) {
  const supabase = getSupabase();
  const traderName = getFormValue(formData, "trader_name");
  const { error } = await supabase.from("positions").insert({
    type: "statement",
    trader_name: traderName,
    ...editableStatementFieldsFromForm(formData),
  });

  if (error) {
    logEvent("error", "admin", "예측 발언 생성 실패", `trader=${traderName} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "예측 발언 생성", `trader=${traderName}`);
  redirect("/admin");
}

// trader_name과 type은 생성 시 한 번만 입력되고 이후 수정하지 않는다.
// 결과(win/draw/loss)도 이 폼의 필드 중 하나라서 다른 값과 함께 저장된다.
export async function updatePosition(id: string, formData: FormData) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("positions")
    .update(editablePositionFieldsFromForm(formData))
    .eq("id", id);

  if (error) {
    logEvent("error", "admin", "포지션 수정 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "포지션 수정", `id=${id}`);
  redirect("/admin");
}

export async function updateStatement(id: string, formData: FormData) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("positions")
    .update(editableStatementFieldsFromForm(formData))
    .eq("id", id);

  if (error) {
    logEvent("error", "admin", "발언 수정 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "발언 수정", `id=${id}`);
  redirect("/admin");
}

export async function deletePosition(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("positions").delete().eq("id", id);

  if (error) {
    logEvent("error", "admin", "포지션 삭제 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent("info", "admin", "포지션 삭제", `id=${id}`);
  redirect("/admin");
}

// 실제 포지션 전용 빠른 계산: 지금 시세로 수익률을 구해 승/무/패를 자동 저장한다.
// +3% 이상 승리, -3% 이하 패배, 그 사이는 무승부. 수정 폼에서 언제든 덮어쓸 수 있다.
export async function closePosition(id: string) {
  const supabase = getSupabase();
  const { data } = await supabase.from("positions").select("*").eq("id", id).maybeSingle();
  const position = data as PositionRow | null;

  if (
    !position ||
    position.type !== "actual" ||
    !position.symbol ||
    position.entry_price === null ||
    position.quantity === null ||
    position.leverage === null
  ) {
    redirect("/admin");
  }

  const markPrice = await getMarkPrice(position.symbol);
  if (markPrice === null) {
    // 현재가를 못 가져오면 계산을 진행하지 않는다.
    logEvent("error", "admin", "빠른 결과 계산 실패", `id=${id} 현재가 조회 실패`);
    redirect("/admin");
  }

  const pnl = getUnrealizedPnl(
    position.direction,
    position.quantity,
    position.entry_price,
    markPrice,
  );
  const returnRate = getReturnRatePercent(
    pnl,
    position.quantity,
    position.entry_price,
    position.leverage,
  );
  const result = getResult(returnRate);

  const { error } = await supabase
    .from("positions")
    .update({
      result,
      result_pnl_percent: returnRate,
      result_recorded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    logEvent("error", "admin", "빠른 결과 계산 저장 실패", `id=${id} ${error.message}`);
    throw new Error(error.message);
  }
  logEvent(
    "info",
    "admin",
    "빠른 결과 계산 완료",
    `id=${id} result=${result} (${returnRate.toFixed(1)}%)`,
  );
  redirect("/admin");
}
