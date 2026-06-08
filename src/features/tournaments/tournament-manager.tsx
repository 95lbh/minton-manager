"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { GitFork, Trophy, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateTournamentRound1,
  generateTournamentManual,
  generateNextRound,
  setMatchResult,
} from "@/server/mutations/tournaments";
import { warnExcluded } from "@/features/tournaments/league-manager";
import { copyStandings } from "@/features/tournaments/share";
import { BracketBuilder } from "@/features/tournaments/bracket-builder";
import type { MatchView } from "@/server/queries/tournaments";
import type { TournamentParticipant } from "@/types/db";

const names = (side: { id: string; name: string }[]) =>
  side.map((p) => p.name).join(" · ");

function roundLabel(count: number) {
  if (count === 1) return "결승";
  if (count === 2) return "준결승";
  return `${count * 2}강`;
}

type Seeding = "skill" | "random";
const SEEDING_LABEL: Record<Seeding, string> = {
  skill: "실력순",
  random: "랜덤",
};

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
          className="h-8 w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
  tournamentName,
  participants,
  isDoubles,
  matches,
  locked = false,
}: {
  tournamentId: string;
  tournamentName: string;
  participants: TournamentParticipant[];
  isDoubles: boolean;
  matches: MatchView[];
  locked?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [seeding, setSeeding] = useState<Seeding>("skill");
  const [manualMode, setManualMode] = useState(false);
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

  // 최종 순위: 탈락 라운드가 깊을수록 상위. 같은 라운드 탈락은 공동 순위.
  const finalStandings = useMemo(() => {
    if (!champion) return [];
    type U = { key: string; label: string; lostRound: number };
    const units = new Map<string, U>();
    const keyOf = (side: { id: string; name: string }[]) =>
      side.map((p) => p.id).sort().join("+");
    const reg = (side: { id: string; name: string }[]) => {
      if (side.length === 0) return null;
      const k = keyOf(side);
      if (!units.has(k)) units.set(k, { key: k, label: names(side), lostRound: 0 });
      return k;
    };
    for (const m of optMatches) {
      const r = m.round ?? 0;
      const bk = reg(m.blue);
      const wk = reg(m.white);
      const w = winnerSide(m);
      if (!w) continue;
      const loser = w === "blue" ? wk : bk;
      if (loser) units.get(loser)!.lostRound = Math.max(units.get(loser)!.lostRound, r);
    }
    // 챔피언(패배 없음)은 lostRound=0 → 가장 위로(탈락 라운드 큰 순 정렬에서 별도 처리).
    const champKey = [...units.values()].find((u) => u.lostRound === 0)?.key;
    const arr = [...units.values()].sort((a, b) => {
      if (a.key === champKey) return -1;
      if (b.key === champKey) return 1;
      return b.lostRound - a.lostRound || a.label.localeCompare(b.label);
    });
    // 공동 순위 부여
    const counts = new Map<number, number>();
    arr.forEach((u) => counts.set(u.lostRound, (counts.get(u.lostRound) ?? 0) + 1));
    let rank = 0;
    let prev: number | null = null;
    return arr.map((u, i) => {
      if (u.key === champKey) {
        rank = 1;
        prev = -1;
      } else if (u.lostRound !== prev) {
        rank = i + 1;
        prev = u.lostRound;
      }
      const tied = u.key !== champKey && (counts.get(u.lostRound) ?? 0) > 1;
      return { key: u.key, label: u.label, rank, tied };
    });
  }, [optMatches, champion]);

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

  const copyResult = () =>
    copyStandings(
      `[${tournamentName}] 토너먼트 최종 순위`,
      finalStandings.map(
        (s) => `${s.tied ? "공동 " : ""}${s.rank}위 ${s.label}`,
      ),
    );

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">토너먼트 대진 / 결과</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            배치 방식을 고른 뒤 대진을 생성하세요. 복식은 실력 균형 페어로 자동 구성됩니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={seeding} onValueChange={(v) => setSeeding((v as Seeding) ?? "skill")}>
            <SelectTrigger className="h-9 w-24">
              <SelectValue>{SEEDING_LABEL[seeding]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skill">실력순</SelectItem>
              <SelectItem value="random">랜덤</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (matches.length > 0 && !confirm("다시 생성하면 기존 대진·점수가 새로 만들어집니다. 계속할까요?")) return;
              run(() => generateTournamentRound1(tournamentId, seeding), "대진을 생성했습니다.");
            }}
            disabled={pending || locked}
          >
            <GitFork className="mr-1 h-4 w-4" /> 자동 생성
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (matches.length > 0 && !confirm("직접 짜기로 생성하면 기존 대진·점수가 새로 만들어집니다. 계속할까요?")) return;
              setManualMode(true);
            }}
            disabled={pending || locked}
          >
            직접 짜기
          </Button>
        </div>
      </div>
      {manualMode && (
        <BracketBuilder
          participants={participants}
          isDoubles={isDoubles}
          pending={pending}
          onCancel={() => setManualMode(false)}
          onGenerate={(ids) => {
            setManualMode(false);
            run(() => generateTournamentManual(tournamentId, ids), "대진을 생성했습니다.");
          }}
        />
      )}

      {champion && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <Trophy className="h-5 w-5" />
          <span className="font-semibold">우승: {champion}</span>
        </div>
      )}

      {finalStandings.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
              최종 순위
            </h3>
            <Button variant="ghost" size="sm" onClick={copyResult}>
              <Copy className="mr-1 h-3.5 w-3.5" /> 복사
            </Button>
          </div>
          <ol className="overflow-hidden rounded-lg border">
            {finalStandings.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-3 border-t px-3 py-2 text-sm first:border-t-0"
              >
                <span
                  className={`w-12 shrink-0 text-xs font-semibold ${s.rank <= 3 ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {s.tied ? "공동 " : ""}
                  {s.rank}위
                </span>
                <span className="min-w-0 truncate">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {rounds.length > 0 && (
        <div className="mt-4">
          {rounds.length > 1 && (
            <p className="mb-1 text-xs text-muted-foreground sm:hidden">
              ← 좌우로 넘겨서 라운드 보기 →
            </p>
          )}
          <div className="flex gap-4 overflow-x-auto pb-2">
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
