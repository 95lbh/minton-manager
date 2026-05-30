"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE } from "@/server/queries/clubs";
import type { ActionResult } from "@/server/types";

/** 클럽 생성 (RPC: clubs + club_admins 트랜잭션). 생성 후 활성 클럽으로 설정. */
export async function createClub(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: { message: "클럽 이름을 입력하세요." } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_club", { _name: name });

  if (error) {
    return { ok: false, error: { message: "클럽 생성에 실패했습니다.", detail: error.message } };
  }

  const club = data as { id: string } | null;
  if (club?.id) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_CLUB_COOKIE, club.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** 활성 클럽 전환. */
export async function setActiveClub(clubId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLUB_COOKIE, clubId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
