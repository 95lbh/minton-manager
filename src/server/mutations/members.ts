"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";
import type { MemberGender } from "@/types/db";

function parseGender(v: FormDataEntryValue | null): MemberGender | null {
  const s = String(v ?? "");
  return s === "male" || s === "female" || s === "other" ? s : null;
}

function parseLevel(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

/** 회원 등록. */
export async function createMember(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: { message: "이름을 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const { error } = await supabase.from("club_members").insert({
    club_id: club.id,
    name,
    gender: parseGender(formData.get("gender")),
    level: parseLevel(formData.get("level")),
  });

  if (error)
    return { ok: false, error: { message: "회원 등록에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.members);
  return { ok: true };
}

/** 회원 수정. */
export async function updateMember(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: { message: "잘못된 요청입니다." } };
  if (!name) return { ok: false, error: { message: "이름을 입력하세요." } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("club_members")
    .update({
      name,
      gender: parseGender(formData.get("gender")),
      level: parseLevel(formData.get("level")),
    })
    .eq("id", id);

  if (error)
    return { ok: false, error: { message: "회원 수정에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.members);
  return { ok: true };
}

/** 회원 삭제 (soft delete). 과거 게임/출석 기록은 보존된다. */
export async function deleteMember(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error)
    return { ok: false, error: { message: "회원 삭제에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.members);
  return { ok: true };
}
