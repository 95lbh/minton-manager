"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/**
 * 클럽의 코트 개수를 target 으로 맞춘다.
 * - 늘리면 "{n}번 코트" 를 뒤에 추가
 * - 줄이면 뒤 번호부터 soft delete (단, 진행 중 게임이 있는 코트는 보호)
 */
export async function setCourtCount(target: number): Promise<ActionResult> {
  if (!Number.isInteger(target) || target < 1 || target > 20) {
    return { ok: false, error: { message: "코트는 1~20개 사이로 설정하세요." } };
  }

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const { data: currentRows } = await supabase
    .from("courts")
    .select("id, sort_order")
    .eq("club_id", club.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const current = currentRows ?? [];

  if (target > current.length) {
    const rows = [];
    for (let i = current.length; i < target; i++) {
      rows.push({ club_id: club.id, name: `${i + 1}번 코트`, sort_order: i + 1 });
    }
    const { error } = await supabase.from("courts").insert(rows);
    if (error)
      return { ok: false, error: { message: "코트 추가에 실패했습니다.", detail: error.message } };
  } else if (target < current.length) {
    const toRemove = current.slice(target); // 뒤쪽 코트들
    const ids = toRemove.map((c) => c.id);

    const { data: ongoing } = await supabase
      .from("games")
      .select("court_id")
      .in("court_id", ids)
      .eq("status", "ongoing");

    if (ongoing && ongoing.length > 0) {
      return {
        ok: false,
        error: { message: "게임이 진행 중인 코트가 있어 줄일 수 없습니다." },
      };
    }

    const { error } = await supabase
      .from("courts")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (error)
      return { ok: false, error: { message: "코트 삭제에 실패했습니다.", detail: error.message } };
  }

  revalidatePath(ROUTES.courts);
  return { ok: true };
}
