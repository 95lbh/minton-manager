"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/** 코트 등록 (정렬 순서는 현재 최대값 +1). */
export async function createCourt(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: { message: "코트 이름을 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("courts")
    .select("sort_order")
    .eq("club_id", club.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("courts").insert({
    club_id: club.id,
    name,
    sort_order: nextOrder,
  });

  if (error)
    return { ok: false, error: { message: "코트 등록에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.courts);
  return { ok: true };
}

/** 코트 이름 수정. */
export async function updateCourt(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: { message: "잘못된 요청입니다." } };
  if (!name) return { ok: false, error: { message: "코트 이름을 입력하세요." } };

  const supabase = await createClient();
  const { error } = await supabase.from("courts").update({ name }).eq("id", id);

  if (error)
    return { ok: false, error: { message: "코트 수정에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.courts);
  return { ok: true };
}

/** 코트 삭제(soft delete). */
export async function deleteCourt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error)
    return { ok: false, error: { message: "코트 삭제에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.courts);
  return { ok: true };
}
