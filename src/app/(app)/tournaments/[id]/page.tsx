import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { getActiveClub } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import { getTournament, getParticipants } from "@/server/queries/tournaments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParticipantsManager } from "@/features/tournaments/participants-manager";
import { StructureSelector } from "@/features/tournaments/structure-selector";
import { TeamSplitManager } from "@/features/tournaments/team-split-manager";
import { DeleteTournamentButton } from "@/features/tournaments/delete-tournament-button";
import {
  ROUTES,
  TOURNAMENT_STATUS_LABEL,
  MATCH_TYPE_LABEL,
} from "@/lib/constants";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const club = await getActiveClub();
  if (!club) return null;

  const tournament = await getTournament(id);
  if (!tournament) notFound();

  const [participants, members] = await Promise.all([
    getParticipants(id),
    getMembers(club.id, false),
  ]);

  return (
    <div>
      <Link
        href={ROUTES.tournaments}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> 대회 목록
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{MATCH_TYPE_LABEL[tournament.match_type]}</span>
            <Badge variant="secondary">
              {TOURNAMENT_STATUS_LABEL[tournament.status]}
            </Badge>
          </div>
        </div>
        <DeleteTournamentButton
          tournamentId={tournament.id}
          tournamentName={tournament.name}
        />
      </div>

      <div className="mt-6 space-y-6">
        <ParticipantsManager
          tournamentId={tournament.id}
          participants={participants}
          members={members}
        />
        <StructureSelector
          tournamentId={tournament.id}
          structure={tournament.structure}
          participantCount={participants.length}
        />
        {tournament.structure === "team_split" && (
          <TeamSplitManager
            tournamentId={tournament.id}
            participants={participants}
          />
        )}
        {(tournament.structure === "team_split" || tournament.structure === "league") && (
          <Link href={`${ROUTES.tournaments}/${id}/games`}>
            <Button className="w-full" size="lg">
              <ListChecks className="mr-1 h-4 w-4" /> 게임 편성 / 결과 페이지로
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
