import { getActiveClub } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import {
  getOrCreateTodaySession,
  getAttendanceRecords,
} from "@/server/queries/attendance";
import { AttendanceManager } from "@/features/attendance/attendance-manager";

export default async function AttendancePage() {
  const club = await getActiveClub();
  if (!club) return null;

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 출석 탭 진입 시 오늘 세션을 자동 확보(없으면 생성). 별도 "시작" 단계 없음.
  const session = await getOrCreateTodaySession(club.id);

  // 회원 목록·출석 레코드는 서로 독립이라 병렬 조회(순차 왕복 제거).
  const [members, records] = session
    ? await Promise.all([
        getMembers(club.id, false),
        getAttendanceRecords(session.id),
      ])
    : [[], []];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">출석 관리</h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{club.name}</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>{today}</span>
      </div>
      {!session ? (
        <p className="mt-10 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          출석 세션을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : (
        <div className="mt-6">
          <AttendanceManager
            session={session}
            members={members}
            records={records}
          />
        </div>
      )}
    </div>
  );
}
