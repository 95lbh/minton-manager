"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTournament } from "@/server/mutations/tournaments";
import { ROUTES } from "@/lib/constants";

export function DeleteTournamentButton({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!confirm(`'${tournamentName}' 대회를 삭제할까요?`)) return;
    startTransition(async () => {
      const res = await deleteTournament(tournamentId);
      if (res.ok) {
        toast.success("대회를 삭제했습니다.");
        router.push(ROUTES.tournaments);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={remove}
      disabled={pending}
    >
      <Trash2 className="mr-1 h-4 w-4" /> 삭제
    </Button>
  );
}
