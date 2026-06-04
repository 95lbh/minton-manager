import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Club, ClubAdmin } from "@/types/db";

export const ACTIVE_CLUB_COOKIE = "active_club_id";

export interface MyClub extends Club {
  role: ClubAdmin["role"];
}

export interface ClubAdminView {
  user_id: string;
  role: ClubAdmin["role"];
  display_name: string | null;
  email: string | null;
  is_owner: boolean;
}

/** 클럽 관리자 목록(소유자/공동 관리자). 프로필 조인은 RPC(정의자)로 처리. */
export async function listClubAdmins(clubId: string): Promise<ClubAdminView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_club_admins", {
    _club_id: clubId,
  });
  if (error || !data) return [];
  return data as ClubAdminView[];
}

/**
 * 현재 로그인 사용자가 속한 클럽 목록(역할 포함).
 * cache()로 감싸 같은 요청 안에서 여러 번 호출돼도 쿼리는 1회만 실행된다
 * (레이아웃 + 페이지 + getActiveClub 내부 호출 중복 제거).
 */
export const getMyClubs = cache(async function getMyClubs(): Promise<MyClub[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // ⚠️ club_admins SELECT RLS는 "내가 속한 클럽의 다른 관리자 행"도 보여주므로,
  //    본인 멤버십 행으로 명시 필터하지 않으면 관리자 2명+ 클럽이 중복 노출된다.
  const { data, error } = await supabase
    .from("club_admins")
    .select("role, clubs!inner(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const seen = new Set<string>();
  const clubs: MyClub[] = [];
  for (const row of data) {
    const club = row.clubs as unknown as Club;
    if (!club || club.deleted_at || seen.has(club.id)) continue;
    seen.add(club.id);
    clubs.push({ ...club, role: row.role } as MyClub);
  }
  return clubs;
});

/**
 * 활성 클럽을 반환한다.
 * 우선순위: 쿠키에 저장된 클럽(소속 확인) → 없으면 첫 번째 클럽 → 없으면 null.
 */
export const getActiveClub = cache(async function getActiveClub(): Promise<MyClub | null> {
  const clubs = await getMyClubs();
  if (clubs.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_CLUB_COOKIE)?.value;
  const matched = activeId ? clubs.find((c) => c.id === activeId) : undefined;
  return matched ?? clubs[0];
});
