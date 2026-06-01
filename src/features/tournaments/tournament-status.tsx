"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setTournamentStatus } from "@/server/mutations/tournaments";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/constants";
import type { TournamentStatus } from "@/types/db";

export function TournamentStatusControl({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: TournamentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: TournamentStatus, msg: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await setTournamentStatus(tournamentId, next);
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={status === "ongoing" ? "default" : "secondary"}>
        {TOURNAMENT_STATUS_LABEL[status]}
      </Badge>
      {status === "draft" && (
        <Button size="sm" onClick={() => change("ongoing", "대회를 시작했습니다.")} disabled={pending}>
          <Play className="mr-1 h-4 w-4" /> 대회 시작
        </Button>
      )}
      {status === "ongoing" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            change("finished", "대회를 종료했습니다.", "대회를 종료하면 결과가 고정됩니다. 계속할까요?")
          }
          disabled={pending}
        >
          <Square className="mr-1 h-4 w-4" /> 대회 종료
        </Button>
      )}
      {status === "finished" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => change("ongoing", "종료를 취소했습니다.")}
          disabled={pending}
        >
          <Undo2 className="mr-1 h-4 w-4" /> 종료 취소
        </Button>
      )}
    </div>
  );
}
