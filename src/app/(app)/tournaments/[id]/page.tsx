import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { getActiveClub } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import { getTournament, getParticipants } from "@/server/queries/tournaments";
import { Button } from "@/components/ui/button";
import { ParticipantsManager } from "@/features/tournaments/participants-manager";
import { StructureSelector } from "@/features/tournaments/structure-selector";
import { TeamSplitManager } from "@/features/tournaments/team-split-manager";
import { TournamentStatusControl } from "@/features/tournaments/tournament-status";
import { DeleteTournamentButton } from "@/features/tournaments/delete-tournament-button";
import { ROUTES, MATCH_TYPE_LABEL } from "@/lib/constants";

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

  const locked = tournament.status === "finished";

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
          <p className="mt-1 text-sm text-muted-foreground">
            {MATCH_TYPE_LABEL[tournament.match_type]}
          </p>
        </div>
        <DeleteTournamentButton
          tournamentId={tournament.id}
          tournamentName={tournament.name}
        />
      </div>

      <div className="mt-3">
        <TournamentStatusControl
          tournamentId={tournament.id}
          status={tournament.status}
        />
      </div>

      <div className="mt-6 space-y-6">
        <ParticipantsManager
          tournamentId={tournament.id}
          participants={participants}
          members={members}
          locked={locked}
        />
        <StructureSelector
          tournamentId={tournament.id}
          structure={tournament.structure}
          participantCount={participants.length}
          locked={locked}
        />
        {tournament.structure === "team_split" && (
          <TeamSplitManager
            tournamentId={tournament.id}
            participants={participants}
            locked={locked}
          />
        )}
        {tournament.structure && (
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
