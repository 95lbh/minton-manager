"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateTeamGames, setMatchResult } from "@/server/mutations/tournaments";
import { TEAM_LABEL } from "@/lib/constants";
import type { MatchView } from "@/server/queries/tournaments";

function MatchRow({
  match,
  pending,
  onSave,
}: {
  match: MatchView;
  pending: boolean;
  onSave: (matchId: string, scoreBlue: number, scoreWhite: number) => void;
}) {
  const [b, setB] = useState(match.scoreBlue?.toString() ?? "");
  const [w, setW] = useState(match.scoreWhite?.toString() ?? "");

  const save = () => {
    if (b === "" || w === "") return;
    const nb = Number(b);
    const nw = Number(w);
    if (Number.isNaN(nb) || Number.isNaN(nw)) return;
    if (nb === match.scoreBlue && nw === match.scoreWhite) return;
    onSave(match.id, nb, nw);
  };

  const decided = match.scoreBlue != null && match.scoreWhite != null;
  const blueWon = decided && match.scoreBlue! > match.scoreWhite!;
  const whiteWon = decided && match.scoreWhite! > match.scoreBlue!;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
      <span className="w-5 shrink-0 text-xs text-muted-foreground">{match.order_no}</span>
      <span className={`min-w-0 flex-1 truncate ${blueWon ? "font-semibold" : ""}`}>
        <span className="rounded bg-sky-100 px-1 text-sky-800">{TEAM_LABEL.blue}</span>{" "}
        {match.blue.map((p) => p.name).join(" · ") || "-"}
      </span>
      <Input
        type="number"
        min={0}
        value={b}
        onChange={(e) => setB(e.target.value)}
        onBlur={save}
        disabled={pending}
        className="h-8 w-14 text-center"
        aria-label="청팀 점수"
      />
      <span className="text-xs text-muted-foreground">:</span>
      <Input
        type="number"
        min={0}
        value={w}
        onChange={(e) => setW(e.target.value)}
        onBlur={save}
        disabled={pending}
        className="h-8 w-14 text-center"
        aria-label="백팀 점수"
      />
      <span className={`min-w-0 flex-1 truncate text-right ${whiteWon ? "font-semibold" : ""}`}>
        {match.white.map((p) => p.name).join(" · ") || "-"}{" "}
        <span className="rounded bg-rose-100 px-1 text-rose-800">{TEAM_LABEL.white}</span>
      </span>
    </li>
  );
}

export function TeamGamesManager({
  tournamentId,
  matches,
  gamesPerPlayer,
  locked = false,
}: {
  tournamentId: string;
  matches: MatchView[];
  gamesPerPlayer: number;
  locked?: boolean;
}) {
  const router = useRouter();
  const [n, setN] = useState(gamesPerPlayer);
  const [pending, startTransition] = useTransition();
  const disabled = pending || locked;

  const standings = useMemo(() => {
    let blueWins = 0,
      whiteWins = 0,
      blueScore = 0,
      whiteScore = 0,
      played = 0;
    for (const m of matches) {
      if (m.scoreBlue == null || m.scoreWhite == null) continue;
      played++;
      blueScore += m.scoreBlue;
      whiteScore += m.scoreWhite;
      if (m.scoreBlue > m.scoreWhite) blueWins++;
      else if (m.scoreWhite > m.scoreBlue) whiteWins++;
    }
    return { blueWins, whiteWins, blueScore, whiteScore, played };
  }, [matches]);

  const generate = () => {
    startTransition(async () => {
      const res = await generateTeamGames(tournamentId, n);
      if (res.ok) {
        toast.success("게임을 편성했습니다.");
        if (res.data && res.data.excluded > 0) {
          toast.warning(`성별 미지정 ${res.data.excluded}명은 편성에서 제외됐어요.`);
        }
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const saveResult = (matchId: string, scoreBlue: number, scoreWhite: number) => {
    startTransition(async () => {
      const res = await setMatchResult(matchId, tournamentId, scoreBlue, scoreWhite);
      if (res.ok) {
        toast.success("점수를 저장했습니다.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">게임 편성 / 결과</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        청팀 vs 백팀 게임을 자동 생성하고 점수를 기록합니다. 모든 인원이 최소 게임 수를
        보장받고 비슷한 실력끼리 매칭됩니다. (다시 편성하면 기존 게임·점수는 새로 생성됩니다.)
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
            disabled={disabled}
            className="w-28"
          />
        </div>
        <Button onClick={generate} disabled={disabled}>
          <ListChecks className="mr-1 h-4 w-4" /> 게임 편성
        </Button>
      </div>

      {matches.length > 0 && (
        <>
          {/* 팀 스코어 요약 */}
          <div className="mt-4 flex items-center justify-center gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="rounded-md bg-sky-100 px-3 py-1 text-center text-sky-900">
              <p className="text-xs">{TEAM_LABEL.blue}</p>
              <p className="font-semibold">
                {standings.blueWins}승 · {standings.blueScore}점
              </p>
            </div>
            <span className="text-muted-foreground">
              {standings.played}/{matches.length} 게임
            </span>
            <div className="rounded-md bg-rose-100 px-3 py-1 text-center text-rose-900">
              <p className="text-xs">{TEAM_LABEL.white}</p>
              <p className="font-semibold">
                {standings.whiteWins}승 · {standings.whiteScore}점
              </p>
            </div>
          </div>

          <ol className="mt-3 space-y-1">
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} pending={disabled} onSave={saveResult} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
