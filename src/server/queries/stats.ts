import { createClient } from "@/lib/supabase/server";
import type { MemberGender } from "@/types/db";

/** 회원별 누적 통계 행 (오늘 한정 아님 — 전체 누적). */
export interface MemberStatRow {
  memberId: string;
  name: string;
  gender: MemberGender | null;
  level: number | null;
  attendCount: number;
  gameCount: number;
  lastPlayedAt: string | null;
}

/** 클럽 요약 통계. */
export interface ClubSummary {
  memberCount: number;
  totalGames: number;
  todayAttendance: number;
  todayGames: number;
}

/**
 * 회원별 통계 목록.
 * member_stats 뷰(출석 세션 수 / 게임 수 / 마지막 게임)를 회원 정보와 조인.
 */
export async function getMemberStats(clubId: string): Promise<MemberStatRow[]> {
  const supabase = await createClient();

  const [membersRes, statsRes] = await Promise.all([
    supabase
      .from("club_members")
      .select("id, name, gender, level")
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("member_stats")
      .select("member_id, attend_cnt, game_cnt, last_played_at")
      .eq("club_id", clubId),
  ]);

  const members = membersRes.data ?? [];
  const statMap = new Map(
    (statsRes.data ?? []).map((s) => [s.member_id as string, s]),
  );

  const rows: MemberStatRow[] = members.map((m) => {
    const s = statMap.get(m.id);
    return {
      memberId: m.id,
      name: m.name,
      gender: m.gender,
      level: m.level,
      attendCount: s?.attend_cnt ?? 0,
      gameCount: s?.game_cnt ?? 0,
      lastPlayedAt: s?.last_played_at ?? null,
    };
  });

  // 게임 수 많은 순 → 출석 많은 순 → 이름
  rows.sort(
    (a, b) =>
      b.gameCount - a.gameCount ||
      b.attendCount - a.attendCount ||
      a.name.localeCompare(b.name),
  );

  return rows;
}

/** 클럽 요약 통계 (회원 수, 누적 게임, 오늘 출석/게임). */
export async function getClubSummary(clubId: string): Promise<ClubSummary> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [membersRes, gamesRes, todaySessionRes] = await Promise.all([
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId),
    supabase
      .from("attendance_sessions")
      .select("id")
      .eq("club_id", clubId)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let todayAttendance = 0;
  let todayGames = 0;
  const sessionId = todaySessionRes.data?.id as string | undefined;
  if (sessionId) {
    const [attRes, gRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId),
      supabase
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId),
    ]);
    todayAttendance = attRes.count ?? 0;
    todayGames = gRes.count ?? 0;
  }

  return {
    memberCount: membersRes.count ?? 0,
    totalGames: gamesRes.count ?? 0,
    todayAttendance,
    todayGames,
  };
}
