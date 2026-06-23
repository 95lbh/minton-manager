import { createClient } from "@/lib/supabase/server";
import { operatingDate } from "@/lib/date";
import type { MemberGender } from "@/types/db";

/** 회원별 누적 통계 행 (오늘 한정 아님 — 전체 누적). */
export interface MemberStatRow {
  memberId: string;
  name: string;
  gender: MemberGender | null;
  level: number | null;
  birthYear: number | null;
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
      .select("id, name, gender, level, birth_year")
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
      birthYear: m.birth_year ?? null,
      attendCount: s?.attend_cnt ?? 0,
      gameCount: s?.game_cnt ?? 0,
      lastPlayedAt: s?.last_played_at ?? null,
    };
  });

  // 게임 수 많은 순 → 출석 많은 순 → 이름
  rows.sort(sortMemberStats);

  return rows;
}

/** 회원별 통계 정렬 기준(게임 → 출석 → 이름). */
function sortMemberStats(a: MemberStatRow, b: MemberStatRow): number {
  return (
    b.gameCount - a.gameCount ||
    b.attendCount - a.attendCount ||
    a.name.localeCompare(b.name)
  );
}

/**
 * 기간([from,to], YYYY-MM-DD) 회원별 통계. session_date 기준.
 * RPC member_stats_range(0023) 사용. 누적은 getMemberStats.
 */
export async function getMemberStatsRange(
  clubId: string,
  from: string,
  to: string,
): Promise<MemberStatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_stats_range", {
    _club_id: clubId,
    _from: from,
    _to: to,
  });
  if (error || !data) return [];

  const rows: MemberStatRow[] = (data as Record<string, unknown>[]).map((r) => ({
    memberId: r.member_id as string,
    name: r.name as string,
    gender: (r.gender as MemberStatRow["gender"]) ?? null,
    level: (r.level as number | null) ?? null,
    birthYear: (r.birth_year as number | null) ?? null,
    attendCount: Number(r.attend_cnt ?? 0),
    gameCount: Number(r.game_cnt ?? 0),
    lastPlayedAt: (r.last_played_at as string | null) ?? null,
  }));
  rows.sort(sortMemberStats);
  return rows;
}

/** 클럽 요약 통계 (회원 수, 누적 게임, 오늘 출석/게임). */
export async function getClubSummary(clubId: string): Promise<ClubSummary> {
  const supabase = await createClient();
  const today = operatingDate();

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
