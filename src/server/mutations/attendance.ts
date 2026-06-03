"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/**
 * 회원 출석 체크.
 * club_id 는 클라이언트가 가진 session.club_id 를 그대로 받는다(별도 클럽 조회 왕복 제거).
 * 권한은 RLS(is_club_member)가 보장하므로 임의 클럽에 삽입할 수 없다.
 */
export async function checkInMember(
  sessionId: string,
  memberId: string,
  clubId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").insert({
    session_id: sessionId,
    club_id: clubId,
    member_id: memberId,
    is_guest: false,
  });

  if (error)
    return { ok: false, error: { message: "출석 처리에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  return { ok: true };
}

/** 게스트(비회원) 출석 추가. 이름 + 성별/실력(선택). club_id 는 클라이언트가 전달. */
export async function addGuest(
  sessionId: string,
  clubId: string,
  guest: { name: string; gender?: "male" | "female" | null; level?: number | null },
): Promise<ActionResult> {
  const name = guest.name.trim();
  if (!name) return { ok: false, error: { message: "게스트 이름을 입력하세요." } };

  const gender =
    guest.gender === "male" || guest.gender === "female" ? guest.gender : null;
  const level =
    typeof guest.level === "number" && guest.level >= 1 && guest.level <= 7
      ? guest.level
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").insert({
    session_id: sessionId,
    club_id: clubId,
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

/** 대기자 상태 변경 (대기중/레슨중/집에감). */
export async function setAttendeeStatus(
  recordId: string,
  status: "present" | "lesson" | "left",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .update({ status })
    .eq("id", recordId);

  if (error)
    return { ok: false, error: { message: "상태 변경에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.attendance);
  revalidatePath(ROUTES.games);
  return { ok: true };
}

/** 출석 취소(레코드 삭제). 게임 참여 이력이 있으면 막고 안내. */
export async function removeRecord(recordId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // 게임에 들어간 적 있으면(진행 중/종료 무관) FK 때문에 삭제 불가 → 미리 막고 안내
  const { count } = await supabase
    .from("game_players")
    .select("id", { count: "exact", head: true })
    .eq("attendance_record_id", recordId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: {
        message:
          "이미 게임 기록이 있어 출석을 취소할 수 없습니다. 대신 '집에감' 상태로 바꿔주세요.",
      },
    };
  }

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
