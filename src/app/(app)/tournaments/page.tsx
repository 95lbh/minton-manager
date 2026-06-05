import { getActiveClub } from "@/server/queries/clubs";
import { getTournaments } from "@/server/queries/tournaments";
import { TournamentsManager } from "@/features/tournaments/tournaments-manager";

export default async function TournamentsPage() {
  const club = await getActiveClub();
  if (!club) return null;

  const tournaments = await getTournaments(club.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">대회 모드</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {club.name} · 토너먼트·리그·청백전 — 참가자부터 대진·점수·순위까지
      </p>
      <div className="mt-6">
        <TournamentsManager tournaments={tournaments} />
      </div>
    </div>
  );
}
