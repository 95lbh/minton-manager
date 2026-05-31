"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/** 코트 1개 추가 ("{n}번 코트"). 코트/게임 화면에서 사용. */
export async function addCourt(): Promise<ActionResult> {
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

  const next = (last?.sort_order ?? 0) + 1;
  const { error } = await supabase
    .from("courts")
    .insert({ club_id: club.id, name: `${next}번 코트`, sort_order: next });

  if (error)
    return { ok: false, error: { message: "코트 추가에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.games);
  return { ok: true };
}

/** 코트 삭제(soft delete). 진행 중 게임이 있으면 거부. */
export async function deleteCourt(courtId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: ongoing } = await supabase
    .from("games")
    .select("id")
    .eq("court_id", courtId)
    .eq("status", "ongoing")
    .limit(1);

  if (ongoing && ongoing.length > 0) {
    return { ok: false, error: { message: "게임이 진행 중인 코트는 삭제할 수 없습니다." } };
  }

  const { error } = await supabase
    .from("courts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", courtId);

  if (error)
    return { ok: false, error: { message: "코트 삭제에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.games);
  return { ok: true };
}
