"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateTeamGames } from "@/server/mutations/tournaments";
import { TEAM_LABEL } from "@/lib/constants";
import type { MatchView } from "@/server/queries/tournaments";

export function TeamGamesManager({
  tournamentId,
  matches,
  gamesPerPlayer,
}: {
  tournamentId: string;
  matches: MatchView[];
  gamesPerPlayer: number;
}) {
  const router = useRouter();
  const [n, setN] = useState(gamesPerPlayer);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      const res = await generateTeamGames(tournamentId, n);
      if (res.ok) {
        toast.success("게임을 편성했습니다.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">게임 편성</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        청팀 vs 백팀 게임을 자동 생성합니다. 모든 인원이 최소 게임 수를 보장받고,
        비슷한 실력끼리 매칭됩니다. (다시 편성하면 기존 게임은 새로 생성됩니다.)
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="gpp" className="text-xs text-muted-foreground">
            인당 보장 게임 수
          </Label>
          <Input
            id="gpp"
            type="number"
            min={1}
            max={30}
            value={n}
            onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))}
            className="w-28"
          />
        </div>
        <Button onClick={generate} disabled={pending}>
          <ListChecks className="mr-1 h-4 w-4" /> 게임 편성
        </Button>
      </div>

      {matches.length > 0 && (
        <ol className="mt-4 space-y-1">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <span className="w-6 shrink-0 text-xs text-muted-foreground">
                {m.order_no}
              </span>
              <span className="flex-1 truncate">
                <span className="text-sky-700">{TEAM_LABEL.blue}</span>{" "}
                {m.blue.map((p) => p.name).join(" · ") || "-"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">vs</span>
              <span className="flex-1 truncate text-right">
                {m.white.map((p) => p.name).join(" · ") || "-"}{" "}
                <span className="text-zinc-700">{TEAM_LABEL.white}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
