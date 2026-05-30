import { getActiveClub } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import {
  getTodaySession,
  getAttendanceRecords,
} from "@/server/queries/attendance";
import { AttendanceManager } from "@/features/attendance/attendance-manager";
import { StartSessionButton } from "@/features/attendance/start-session-button";

export default async function AttendancePage() {
  const club = await getActiveClub();
  if (!club) return null;

  const session = await getTodaySession(club.id);
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-bold">출석 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {club.name} · {today}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            아직 오늘의 출석 세션이 없습니다.
          </p>
          <StartSessionButton />
        </div>
      </div>
    );
  }

  const [members, records] = await Promise.all([
    getMembers(club.id, false), // active 회원만
    getAttendanceRecords(session.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">출석 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {club.name} · {today}
      </p>
      <div className="mt-6">
        <AttendanceManager
          session={session}
          members={members}
          records={records}
        />
      </div>
    </div>
  );
}
