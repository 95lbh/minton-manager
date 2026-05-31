import Link from "next/link";
import { getActiveClub } from "@/server/queries/clubs";
import { getTodaySession } from "@/server/queries/attendance";
import { getCourtViewData } from "@/server/queries/games";
import { ROUTES } from "@/lib/constants";
import { CourtBoard } from "@/features/games/court-board";

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

  const data = await getCourtViewData(club.id, session.id);

  if (data.courts.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">코트/게임</h1>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            등록된 코트가 없습니다. 먼저 코트를 등록하세요.
          </p>
          <Link href={ROUTES.courts} className={linkButton}>
            코트 관리로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">코트/게임</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {club.name} · 코트 {data.courts.length}개 · 대기 {data.pool.length}명
      </p>
      <div className="mt-6">
        <CourtBoard sessionId={session.id} data={data} />
      </div>
    </div>
  );
}
