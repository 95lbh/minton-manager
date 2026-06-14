import { createClient } from "@/lib/supabase/server";
import type { MemberGender } from "@/types/db";

export interface CheckinMember {
  id: string;
  name: string;
  gender: MemberGender | null;
  level: number | null;
  present: boolean;
}

export interface CheckinRoster {
  sessionId: string;
  clubName: string;
  sessionDate: string;
  status: string;
  members: CheckinMember[];
}

/**
 * 공개 체크인 토큰으로 명단을 조회한다(비로그인 anon).
 * SECURITY DEFINER RPC(get_checkin_roster)가 토큰으로 범위를 제한한다.
 * 유효하지 않은 토큰이거나 회원이 없으면 null.
 */
export async function getCheckinRoster(
  token: string,
): Promise<CheckinRoster | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_checkin_roster", {
    _token: token,
  });
  if (error || !data || data.length === 0) return null;

  const first = data[0] as Record<string, unknown>;
  return {
    sessionId: first.session_id as string,
    clubName: first.club_name as string,
    sessionDate: first.session_date as string,
    status: first.session_status as string,
    members: (data as Record<string, unknown>[]).map((r) => ({
      id: r.member_id as string,
      name: r.member_name as string,
      gender: (r.gender as MemberGender | null) ?? null,
      level: (r.level as number | null) ?? null,
      present: Boolean(r.present),
    })),
  };
}
