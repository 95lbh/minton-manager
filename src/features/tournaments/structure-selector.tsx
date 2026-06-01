"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setTournamentStructure } from "@/server/mutations/tournaments";
import { TOURNAMENT_STRUCTURE_LABEL } from "@/lib/constants";
import type { TournamentStructure } from "@/types/db";

const OPTIONS: { value: TournamentStructure; desc: string }[] = [
  { value: "tournament", desc: "토너먼트(대진 승자 진출)" },
  { value: "league", desc: "리그전(서로 한 번씩)" },
  { value: "team_split", desc: "청팀/백팀으로 나눠 진행" },
];

export function StructureSelector({
  tournamentId,
  structure,
  participantCount,
  locked = false,
}: {
  tournamentId: string;
  structure: TournamentStructure | null;
  participantCount: number;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (value: TournamentStructure) => {
    if (value === structure) return;
    startTransition(async () => {
      const res = await setTournamentStructure(tournamentId, value);
      if (res.ok) {
        toast.success(`형식: ${TOURNAMENT_STRUCTURE_LABEL[value]}`);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">대회 형식</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        참가자를 모두 등록한 뒤 형식을 선택하세요. (현재 참가자 {participantCount}명)
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant={structure === o.value ? "default" : "outline"}
            className="h-auto flex-col items-start gap-1 py-3 text-left"
            onClick={() => choose(o.value)}
            disabled={pending || locked}
          >
            <span className="font-medium">{TOURNAMENT_STRUCTURE_LABEL[o.value]}</span>
            <span className="text-xs font-normal opacity-80">{o.desc}</span>
          </Button>
        ))}
      </div>
      {structure && (
        <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          아래 “게임 편성 / 결과 페이지”에서 대진을 만들고 점수를 기록하세요.
        </p>
      )}
    </section>
  );
}
