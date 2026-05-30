import { createClient } from "@/lib/supabase/server";
import type { AttendanceSession, AttendanceRecord, MemberGender } from "@/types/db";

/** 출석 레코드 + 회원 정보(있으면) 조인 뷰모델 */
export interface AttendanceRecordView extends AttendanceRecord {
  member: {
    id: string;
    name: string;
    gender: MemberGender | null;
    level: number | null;
  } | null;
}

/** 오늘 날짜의 가장 최근 세션(없으면 null). */
export async function getTodaySession(
  clubId: string,
): Promise<AttendanceSession | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("club_id", clubId)
    .eq("session_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as AttendanceSession;
}

/** 세션의 출석 레코드(회원 정보 조인). 출석 시각 순. */
export async function getAttendanceRecords(
  sessionId: string,
): Promise<AttendanceRecordView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      "*, member:club_members(id, name, gender, level)",
    )
    .eq("session_id", sessionId)
    .order("checked_in_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as AttendanceRecordView[];
}
