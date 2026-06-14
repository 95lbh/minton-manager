import Link from "next/link";
import { getActiveClub } from "@/server/queries/clubs";
import { getTodaySession, getAttendanceRecords } from "@/server/queries/attendance";
import { getCourtViewData } from "@/server/queries/games";
import { getMembers } from "@/server/queries/members";
import { ROUTES } from "@/lib/constants";
import { CourtBoard } from "@/features/games/court-board";
import { QuickCheckinDrawer } from "@/features/games/quick-checkin-drawer";

const linkButton =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

export default async function GamesPage() {
  const club = await getActiveClub();
  if (!club) return null;

  const session = await getTodaySession(club.id);

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-bold">코트/게임</h1>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            오늘의 출석 세션이 없습니다. 먼저 출석을 시작하세요.
          </p>
          <Link href={ROUTES.attendance} className={linkButton}>
            출석 관리로 이동
          </Link>
        </div>
      </div>
    );
  }

  const [data, members, records] = await Promise.all([
    getCourtViewData(club.id, session.id),
    getMembers(club.id, false),
    getAttendanceRecords(session.id),
  ]);

  const ongoingCount = data.ongoing.length;
  const attendedMemberIds = records
    .filter((r) => r.member_id)
    .map((r) => r.member_id as string);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">코트 현황</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{club.name}</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span>코트 {data.courts.length}개</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="text-accent">진행 {ongoingCount}</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span>대기 {data.pool.length}명</span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <CourtBoard clubId={club.id} sessionId={session.id} data={data} />
      </div>

      <QuickCheckinDrawer
        sessionId={session.id}
        clubId={club.id}
        checkinToken={session.checkin_token}
        members={members}
        attendedMemberIds={attendedMemberIds}
      />
    </div>
  );
}
