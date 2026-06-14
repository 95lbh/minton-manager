import { createClient } from "@/lib/supabase/server";

/** 신규 클럽 시작 가이드용 진행 상황(각 단계 데이터 유무). */
export interface OnboardingProgress {
  members: number;
  courts: number;
  attendance: number;
  games: number;
}

/**
 * 클럽의 핵심 데이터 개수를 한 번에 집계한다.
 * 대시보드 "시작 체크리스트"에서 단계 완료 여부 판정에 사용.
 */
export async function getOnboardingProgress(
  clubId: string,
): Promise<OnboardingProgress> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [members, courts, attendance, games] = await Promise.all([
    supabase
      .from("club_members")
      .select("id", head)
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("courts")
      .select("id", head)
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase.from("attendance_records").select("id", head).eq("club_id", clubId),
    supabase.from("games").select("id", head).eq("club_id", clubId),
  ]);

  return {
    members: members.count ?? 0,
    courts: courts.count ?? 0,
    attendance: attendance.count ?? 0,
    games: games.count ?? 0,
  };
}
