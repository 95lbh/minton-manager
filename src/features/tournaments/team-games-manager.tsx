"use client";

import { useMemo, useOptimistic, useState } from "react";
import { useServerAction } from "@/hooks/use-server-action";
import { toast } from "sonner";
import { ListChecks, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateTeamGames, setMatchResult } from "@/server/mutations/tournaments";
import { warnExcluded } from "@/features/tournaments/league-manager";
import { copyStandings } from "@/features/tournaments/share";
import { TEAM_LABEL } from "@/lib/constants";
import type { MatchView } from "@/server/queries/tournaments";

function MatchRow({
  match,
  disabled,
  onSave,
}: {
  match: MatchView;
  disabled: boolean;
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
      <span className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          min={0}
          value={b}
          onChange={(e) => setB(e.target.value)}
          onBlur={save}
          disabled={disabled}
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
          disabled={disabled}
          className="h-8 w-14 text-center"
          aria-label="백팀 점수"
        />
      </span>
      <span className={`min-w-0 flex-1 truncate text-right ${whiteWon ? "font-semibold" : ""}`}>
        {match.white.map((p) => p.name).join(" · ") || "-"}{" "}
        <span className="rounded bg-rose-100 px-1 text-rose-800">{TEAM_LABEL.white}</span>
      </span>
    </li>
  );
}

export function TeamGamesManager({
  tournamentId,
  tournamentName,
  matches,
  gamesPerPlayer,
  locked = false,
}: {
  tournamentId: string;
  tournamentName: string;
  matches: MatchView[];
  gamesPerPlayer: number;
  locked?: boolean;
}) {
  const [n, setN] = useState(gamesPerPlayer);
  const { pending, run: runAction } = useServerAction();
  // 점수 입력 즉시 반영(낙관적). 팀 스코어 요약도 함께 갱신.
  const [optMatches, applyScore] = useOptimistic(
    matches,
    (state: MatchView[], u: { matchId: string; a: number; b: number }) =>
      state.map((m) =>
        m.id === u.matchId ? { ...m, scoreBlue: u.a, scoreWhite: u.b } : m,
      ),
  );

  const standings = useMemo(() => {
    let blueWins = 0,
      whiteWins = 0,
      blueScore = 0,
      whiteScore = 0,
      played = 0;
    for (const m of optMatches) {
      if (m.scoreBlue == null || m.scoreWhite == null) continue;
      played++;
      blueScore += m.scoreBlue;
      whiteScore += m.scoreWhite;
      if (m.scoreBlue > m.scoreWhite) blueWins++;
      else if (m.scoreWhite > m.scoreBlue) whiteWins++;
    }
    return { blueWins, whiteWins, blueScore, whiteScore, played };
  }, [optMatches]);

  // 개인 통계: 참가자별 출전·승·총점 (결과 입력된 게임 기준).
  const individuals = useMemo(() => {
    type Row = { id: string; name: string; team: "blue" | "white"; games: number; wins: number; points: number };
    const map = new Map<string, Row>();
    const touch = (
      p: { id: string; name: string },
      team: "blue" | "white",
      won: boolean,
      pts: number,
    ) => {
      const e =
        map.get(p.id) ?? { id: p.id, name: p.name, team, games: 0, wins: 0, points: 0 };
      e.games++;
      if (won) e.wins++;
      e.points += pts;
      map.set(p.id, e);
    };
    for (const m of optMatches) {
      if (m.scoreBlue == null || m.scoreWhite == null) continue;
      const blueWon = m.scoreBlue > m.scoreWhite;
      const whiteWon = m.scoreWhite > m.scoreBlue;
      m.blue.forEach((p) => touch(p, "blue", blueWon, m.scoreBlue!));
      m.white.forEach((p) => touch(p, "white", whiteWon, m.scoreWhite!));
    }
    return [...map.values()].sort(
      (a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name),
    );
  }, [optMatches]);

  const generate = () => {
    if (
      matches.length > 0 &&
      !confirm("다시 편성하면 기존 대진·점수가 모두 새로 만들어집니다. 계속할까요?")
    )
      return;
    runAction(() => generateTeamGames(tournamentId, n), {
      success: "게임을 편성했습니다.",
      onSuccess: (d) => {
        if (d) warnExcluded(d.excludedNames);
        if (d?.imbalance) toast.warning(d.imbalance);
      },
    });
  };

  const saveResult = (matchId: string, scoreBlue: number, scoreWhite: number) =>
    runAction(() => setMatchResult(matchId, tournamentId, scoreBlue, scoreWhite), {
      optimistic: () => applyScore({ matchId, a: scoreBlue, b: scoreWhite }),
    });

  const copyResult = () =>
    copyStandings(`[${tournamentName}] 청백전 결과`, [
      `${TEAM_LABEL.blue} ${standings.blueWins}승 ${standings.blueScore}점 / ${TEAM_LABEL.white} ${standings.whiteWins}승 ${standings.whiteScore}점`,
      "",
      "개인 기록",
      ...individuals.map(
        (r, i) => `${i + 1}. ${r.name} (${r.wins}승, ${r.points}점, ${r.games}게임)`,
      ),
    ]);

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
            disabled={pending || locked}
            className="w-28"
          />
        </div>
        <Button onClick={generate} disabled={pending || locked}>
          <ListChecks className="mr-1 h-4 w-4" /> 게임 편성
        </Button>
      </div>

      {optMatches.length > 0 && (
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
              {standings.played}/{optMatches.length} 게임
            </span>
            <div className="rounded-md bg-rose-100 px-3 py-1 text-center text-rose-900">
              <p className="text-xs">{TEAM_LABEL.white}</p>
              <p className="font-semibold">
                {standings.whiteWins}승 · {standings.whiteScore}점
              </p>
            </div>
          </div>

          {individuals.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  개인 기록
                </h3>
                <Button variant="ghost" size="sm" onClick={copyResult}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> 결과 복사
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">선수</th>
                      <th className="px-3 py-2 text-center">게임</th>
                      <th className="px-3 py-2 text-center">승</th>
                      <th className="px-3 py-2 text-center">총점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individuals.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              role="img"
                              aria-label={r.team === "blue" ? "청팀" : "백팀"}
                              className={`size-2 shrink-0 rounded-full ${r.team === "blue" ? "bg-sky-500" : "bg-rose-500"}`}
                            />
                            <span className="truncate">{r.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{r.games}</td>
                        <td className="px-3 py-2 text-center font-medium">{r.wins}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ol className="mt-3 space-y-1">
            {optMatches.map((m) => (
              <MatchRow key={m.id} match={m} disabled={locked} onSave={saveResult} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
