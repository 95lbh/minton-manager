"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { GitFork, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateTournamentRound1,
  generateNextRound,
  setMatchResult,
} from "@/server/mutations/tournaments";
import { warnExcluded } from "@/features/tournaments/league-manager";
import type { MatchView } from "@/server/queries/tournaments";

const names = (side: { id: string; name: string }[]) =>
  side.map((p) => p.name).join(" · ");

function roundLabel(count: number) {
  if (count === 1) return "결승";
  if (count === 2) return "준결승";
  return `${count * 2}강`;
}

/** 부전승(한쪽 없음)이거나 점수가 입력되어 승부가 갈렸는가 */
function isDecided(m: MatchView) {
  if (m.blue.length === 0 || m.white.length === 0) return true;
  return m.scoreBlue != null && m.scoreWhite != null && m.scoreBlue !== m.scoreWhite;
}
function winnerSide(m: MatchView): "blue" | "white" | null {
  if (m.white.length === 0) return "blue";
  if (m.blue.length === 0) return "white";
  if (m.scoreBlue == null || m.scoreWhite == null || m.scoreBlue === m.scoreWhite) return null;
  return m.scoreBlue > m.scoreWhite ? "blue" : "white";
}

/** 브래킷 셀: 위(청)·아래(백) 2명 스택 + 가운데 점수. */
function MatchCard({
  match,
  disabled,
  onSave,
}: {
  match: MatchView;
  disabled: boolean;
  onSave: (matchId: string, a: number, b: number) => void;
}) {
  const [a, setA] = useState(match.scoreBlue?.toString() ?? "");
  const [b, setB] = useState(match.scoreWhite?.toString() ?? "");
  const bye = match.blue.length === 0 || match.white.length === 0;
  const win = winnerSide(match);

  const save = () => {
    if (a === "" || b === "") return;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) return;
    if (na === match.scoreBlue && nb === match.scoreWhite) return;
    onSave(match.id, na, nb);
  };

  const sideRow = (
    side: "blue" | "white",
    people: { id: string; name: string }[],
    score: string,
    setScore: (v: string) => void,
  ) => (
    <div className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate ${win === side ? "font-semibold" : ""}`}>
        {names(people) || <span className="text-muted-foreground">부전승</span>}
      </span>
      {!bye && (
        <Input
          type="number"
          min={0}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onBlur={save}
          disabled={disabled}
          className="h-7 w-12 text-center"
          aria-label={`${side === "blue" ? "위" : "아래"} 점수`}
        />
      )}
    </div>
  );

  return (
    <div className="rounded-lg border bg-background p-2 text-sm">
      {sideRow("blue", match.blue, a, setA)}
      <div className="my-1 border-t" />
      {sideRow("white", match.white, b, setB)}
      {bye && <p className="mt-1 text-center text-xs text-muted-foreground">자동 진출</p>}
    </div>
  );
}

export function TournamentManager({
  tournamentId,
  matches,
  locked = false,
}: {
  tournamentId: string;
  matches: MatchView[];
  locked?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // 점수 입력 즉시 반영(낙관적). 우승자·다음 라운드 가능 여부도 함께 갱신.
  const [optMatches, applyScore] = useOptimistic(
    matches,
    (state: MatchView[], u: { matchId: string; a: number; b: number }) =>
      state.map((m) =>
        m.id === u.matchId ? { ...m, scoreBlue: u.a, scoreWhite: u.b } : m,
      ),
  );

  const { rounds, maxRound, champion, canAdvance } = useMemo(() => {
    const byRound = new Map<number, MatchView[]>();
    for (const m of optMatches) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    const nums = [...byRound.keys()].sort((a, b) => a - b);
    for (const r of nums) byRound.get(r)!.sort((a, b) => a.order_no - b.order_no);
    const max = nums.length ? nums[nums.length - 1] : 0;
    const last = max ? byRound.get(max)! : [];
    let champ: string | null = null;
    if (last.length === 1 && isDecided(last[0])) {
      const w = winnerSide(last[0]);
      champ = w === "blue" ? names(last[0].blue) : w === "white" ? names(last[0].white) : null;
    }
    const advance = last.length > 1 && last.every(isDecided);
    return {
      rounds: nums.map((r) => ({ r, matches: byRound.get(r)! })),
      maxRound: max,
      champion: champ,
      canAdvance: advance,
    };
  }, [optMatches]);

  // 대진 생성/다음 라운드(구조 변경) — revalidate로 갱신, 제외 인원 안내.
  const run = (
    fn: () => Promise<{
      ok: boolean;
      error?: { message: string };
      data?: { excludedNames?: string[] };
    }>,
    msg: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(msg);
        warnExcluded(res.data?.excludedNames ?? []);
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  const saveResult = (matchId: string, a: number, b: number) => {
    startTransition(async () => {
      applyScore({ matchId, a, b });
      const res = await setMatchResult(matchId, tournamentId, a, b);
      if (!res.ok) toast.error(res.error.message);
    });
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">토너먼트 대진 / 결과</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            실력 시드로 배치합니다. 복식은 실력 균형 페어로 자동 구성됩니다.
          </p>
        </div>
        <Button
          onClick={() => {
            if (matches.length > 0 && !confirm("다시 생성하면 기존 대진·점수가 새로 만들어집니다. 계속할까요?")) return;
            run(() => generateTournamentRound1(tournamentId), "대진을 생성했습니다.");
          }}
          disabled={pending || locked}
        >
          <GitFork className="mr-1 h-4 w-4" /> 대진 생성
        </Button>
      </div>

      {champion && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <Trophy className="h-5 w-5" />
          <span className="font-semibold">우승: {champion}</span>
        </div>
      )}

      {rounds.length > 0 && (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {rounds.map(({ r, matches: ms }) => (
            <div key={r} className="flex min-w-[220px] flex-1 flex-col">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {roundLabel(ms.length)}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {ms.map((m) => (
                  <MatchCard key={m.id} match={m} disabled={locked} onSave={saveResult} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {maxRound > 0 && !champion && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => run(() => generateNextRound(tournamentId), "다음 라운드를 만들었습니다.")}
          disabled={pending || locked || !canAdvance}
        >
          다음 라운드 생성 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
      {maxRound > 0 && !champion && !canAdvance && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          이번 라운드 결과를 모두 입력하면 다음 라운드를 만들 수 있어요.
        </p>
      )}
    </section>
  );
}
