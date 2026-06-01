import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTournament, getMatches } from "@/server/queries/tournaments";
import { TeamGamesManager } from "@/features/tournaments/team-games-manager";
import { LeagueManager } from "@/features/tournaments/league-manager";
import { TournamentManager } from "@/features/tournaments/tournament-manager";
import {
  ROUTES,
  MATCH_TYPE_LABEL,
  TOURNAMENT_STRUCTURE_LABEL,
} from "@/lib/constants";

export default async function TournamentGamesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) notFound();

  const hasGames = tournament.structure !== null;
  const matches = hasGames ? await getMatches(id) : [];

  return (
    <div>
      <Link
        href={`${ROUTES.tournaments}/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {tournament.name}
      </Link>

      <h1 className="mt-2 text-2xl font-bold">게임 편성 / 결과</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {MATCH_TYPE_LABEL[tournament.match_type]}
        {tournament.structure ? ` · ${TOURNAMENT_STRUCTURE_LABEL[tournament.structure]}` : ""}
      </p>

      <div className="mt-6">
        {tournament.structure === "team_split" ? (
          <TeamGamesManager
            tournamentId={tournament.id}
            matches={matches}
            gamesPerPlayer={tournament.games_per_player}
          />
        ) : tournament.structure === "league" ? (
          <LeagueManager tournamentId={tournament.id} matches={matches} />
        ) : tournament.structure === "tournament" ? (
          <TournamentManager tournamentId={tournament.id} matches={matches} />
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            먼저 대회 형식을 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}
