import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Club, ClubAdmin } from "@/types/db";

export const ACTIVE_CLUB_COOKIE = "active_club_id";

export interface MyClub extends Club {
  role: ClubAdmin["role"];
}

/** 현재 로그인 사용자가 속한 클럽 목록(역할 포함). */
export async function getMyClubs(): Promise<MyClub[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_admins")
    .select("role, clubs!inner(*)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => {
      const club = row.clubs as unknown as Club;
      if (!club || club.deleted_at) return null;
      return { ...club, role: row.role } as MyClub;
    })
    .filter((c): c is MyClub => c !== null);
}

/**
 * 활성 클럽을 반환한다.
 * 우선순위: 쿠키에 저장된 클럽(소속 확인) → 없으면 첫 번째 클럽 → 없으면 null.
 */
export async function getActiveClub(): Promise<MyClub | null> {
  const clubs = await getMyClubs();
  if (clubs.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_CLUB_COOKIE)?.value;
  const matched = activeId ? clubs.find((c) => c.id === activeId) : undefined;
  return matched ?? clubs[0];
}
