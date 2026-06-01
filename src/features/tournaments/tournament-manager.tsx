"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitFork, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateTournamentRound1,
  generateNextRound,
  setMatchResult,
} from "@/server/mutations/tournaments";
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

function MatchRow({
  match,
  pending,
  onSave,
}: {
  match: MatchView;
  pending: boolean;
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

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
      <span className={`min-w-0 flex-1 truncate ${win === "blue" ? "font-semibold" : ""}`}>
        {names(match.blue) || <span className="text-muted-foreground">부전승</span>}
      </span>
      {bye ? (
        <span className="text-xs text-muted-foreground">자동 진출</span>
      ) : (
        <>
          <Input
            type="number"
            min={0}
            value={a}
            onChange={(e) => setA(e.target.value)}
            onBlur={save}
            disabled={pending}
            className="h-8 w-12 text-center"
            aria-label="왼쪽 점수"
          />
          <span className="text-xs text-muted-foreground">:</span>
          <Input
            type="number"
            min={0}
            value={b}
            onChange={(e) => setB(e.target.value)}
            onBlur={save}
            disabled={pending}
            className="h-8 w-12 text-center"
            aria-label="오른쪽 점수"
          />
        </>
      )}
      <span className={`min-w-0 flex-1 truncate text-right ${win === "white" ? "font-semibold" : ""}`}>
        {names(match.white) || <span className="text-muted-foreground">부전승</span>}
      </span>
    </li>
  );
}

export function TournamentManager({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: MatchView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { rounds, maxRound, champion, canAdvance } = useMemo(() => {
    const byRound = new Map<number, MatchView[]>();
    for (const m of matches) {
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
  }, [matches]);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string }; data?: { excluded: number } }>,
    msg: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(msg);
        if (res.data && res.data.excluded > 0) {
          toast.warning(`복식 페어가 안 맞아 ${res.data.excluded}명은 제외됐어요.`);
        }
        router.refresh();
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  const saveResult = (matchId: string, a: number, b: number) =>
    run(() => setMatchResult(matchId, tournamentId, a, b), "점수를 저장했습니다.");

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
          disabled={pending}
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

      {rounds.map(({ r, matches: ms }) => (
        <div key={r} className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            {roundLabel(ms.length)} ({r}라운드)
          </h3>
          <ol className="space-y-1">
            {ms.map((m) => (
              <MatchRow key={m.id} match={m} pending={pending} onSave={saveResult} />
            ))}
          </ol>
        </div>
      ))}

      {maxRound > 0 && !champion && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => run(() => generateNextRound(tournamentId), "다음 라운드를 만들었습니다.")}
          disabled={pending || !canAdvance}
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
