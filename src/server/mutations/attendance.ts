"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/** 오늘 세션을 생성(이미 있으면 그대로 반환). */
export async function startTodaySession(): Promise<ActionResult<{ id: string }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // 이미 오늘 세션이 있으면 재사용
  const { data: existing } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("club_id", club.id)
    .eq("session_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    revalidatePath(ROUTES.attendance);
    return { ok: true, data: { id: existing.id } };
  }

  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({ club_id: club.id, session_date: today })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, error: { message: "세션 생성에 실패했습니다.", detail: error?.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true, data: { id: data.id } };
}

/** 회원 출석 체크. */
export async function checkInMember(
  sessionId: string,
  memberId: string,
): Promise<ActionResult> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").insert({
    session_id: sessionId,
    club_id: club.id,
    member_id: memberId,
    is_guest: false,
  });

  if (error)
    return { ok: false, error: { message: "출석 처리에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true };
}

/** 게스트(비회원) 출석 추가. 이름 + 성별/실력(선택). */
export async function addGuest(
  sessionId: string,
  guest: { name: string; gender?: "male" | "female" | null; level?: number | null },
): Promise<ActionResult> {
  const name = guest.name.trim();
  if (!name) return { ok: false, error: { message: "게스트 이름을 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const gender =
    guest.gender === "male" || guest.gender === "female" ? guest.gender : null;
  const level =
    typeof guest.level === "number" && guest.level >= 1 && guest.level <= 7
      ? guest.level
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").insert({
    session_id: sessionId,
    club_id: club.id,
    member_id: null,
    guest_name: name,
    guest_gender: gender,
    guest_level: level,
    is_guest: true,
  });

  if (error)
    return { ok: false, error: { message: "게스트 추가에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true };
}

/** 출석 취소(레코드 삭제). */
export async function removeRecord(recordId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId);

  if (error)
    return { ok: false, error: { message: "출석 취소에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true };
}

/** 세션 마감/재개. */
export async function setSessionStatus(
  sessionId: string,
  status: "open" | "closed",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error)
    return { ok: false, error: { message: "세션 상태 변경에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true };
}
