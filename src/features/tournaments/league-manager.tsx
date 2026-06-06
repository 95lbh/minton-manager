"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Network, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateLeague, setMatchResult } from "@/server/mutations/tournaments";
import { copyStandings } from "@/features/tournaments/share";
import type { MatchView } from "@/server/queries/tournaments";

function names(side: { id: string; name: string }[]) {
  return side.map((p) => p.name).join(" · ") || "-";
}
function unitKey(side: { id: string; name: string }[]) {
  return side.map((p) => p.id).sort().join("+");
}

/** 제외 인원 안내 토스트(이름 일부 + N명). */
export function warnExcluded(excludedNames: string[]) {
  if (excludedNames.length === 0) return;
  const shown = excludedNames.slice(0, 3).join(", ");
  const more = excludedNames.length > 3 ? ` 외 ${excludedNames.length - 3}명` : "";
  toast.warning(`편성에서 제외: ${shown}${more} (성별/페어 조건)`);
}

function MatchRow({
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

  const save = () => {
    if (a === "" || b === "") return;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) return;
    if (na === match.scoreBlue && nb === match.scoreWhite) return;
    onSave(match.id, na, nb);
  };

  const decided = match.scoreBlue != null && match.scoreWhite != null;
  const aWon = decided && match.scoreBlue! > match.scoreWhite!;
  const bWon = decided && match.scoreWhite! > match.scoreBlue!;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
      <span className="w-5 shrink-0 text-xs text-muted-foreground">{match.order_no}</span>
      <span className={`min-w-0 flex-1 truncate ${aWon ? "font-semibold" : ""}`}>
        {names(match.blue)}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          min={0}
          value={a}
          onChange={(e) => setA(e.target.value)}
          onBlur={save}
          disabled={disabled}
          className="h-8 w-14 text-center"
          aria-label="왼쪽 점수"
        />
        <span className="text-xs text-muted-foreground">:</span>
        <Input
          type="number"
          min={0}
          value={b}
          onChange={(e) => setB(e.target.value)}
          onBlur={save}
          disabled={disabled}
          className="h-8 w-14 text-center"
          aria-label="오른쪽 점수"
        />
      </span>
      <span className={`min-w-0 flex-1 truncate text-right ${bWon ? "font-semibold" : ""}`}>
        {names(match.white)}
      </span>
    </li>
  );
}

export function LeagueManager({
  tournamentId,
  tournamentName,
  matches,
  locked = false,
}: {
  tournamentId: string;
  tournamentName: string;
  matches: MatchView[];
  locked?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // 점수 입력을 즉시 반영(낙관적). 서버 revalidate 후 props와 동기화.
  const [optMatches, applyScore] = useOptimistic(
    matches,
    (state: MatchView[], u: { matchId: string; a: number; b: number }) =>
      state.map((m) =>
        m.id === u.matchId ? { ...m, scoreBlue: u.a, scoreWhite: u.b } : m,
      ),
  );

  const standings = useMemo(() => {
    type Row = { key: string; label: string; played: number; wins: number; losses: number; pf: number; pa: number };
    const units = new Map<string, Row>();
    // 직접전(head-to-head): winnerKey → loserKey → 승 횟수
    const h2h = new Map<string, Map<string, number>>();
    const beat = (wk: string, lk: string) => {
      if (!h2h.has(wk)) h2h.set(wk, new Map());
      const m = h2h.get(wk)!;
      m.set(lk, (m.get(lk) ?? 0) + 1);
    };
    const reg = (side: { id: string; name: string }[]) => {
      const key = unitKey(side);
      if (!units.has(key)) units.set(key, { key, label: names(side), played: 0, wins: 0, losses: 0, pf: 0, pa: 0 });
      return key;
    };
    for (const m of optMatches) {
      const bk = reg(m.blue);
      const wk = reg(m.white);
      if (m.scoreBlue == null || m.scoreWhite == null) continue;
      const ub = units.get(bk)!;
      const uw = units.get(wk)!;
      ub.played++; uw.played++;
      ub.pf += m.scoreBlue; ub.pa += m.scoreWhite;
      uw.pf += m.scoreWhite; uw.pa += m.scoreBlue;
      if (m.scoreBlue > m.scoreWhite) { ub.wins++; uw.losses++; beat(bk, wk); }
      else if (m.scoreWhite > m.scoreBlue) { uw.wins++; ub.losses++; beat(wk, bk); }
    }
    const h2hWins = (x: string, y: string) => h2h.get(x)?.get(y) ?? 0;
    // 정렬: 승수 → 직접전(맞대결 우위) → 득실 → 이름
    return [...units.values()].sort(
      (a, b) =>
        b.wins - a.wins ||
        h2hWins(b.key, a.key) - h2hWins(a.key, b.key) ||
        b.pf - b.pa - (a.pf - a.pa) ||
        a.label.localeCompare(b.label),
    );
  }, [optMatches]);

  const generate = () => {
    if (matches.length > 0 && !confirm("다시 생성하면 기존 대진·점수가 새로 만들어집니다. 계속할까요?"))
      return;
    startTransition(async () => {
      const res = await generateLeague(tournamentId);
      if (res.ok) {
        toast.success("리그 대진을 생성했습니다.");
        if (res.data) warnExcluded(res.data.excludedNames);
      } else {
        toast.error(res.error.message);
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
      `[${tournamentName}] 리그 순위`,
      standings.map(
        (r, i) =>
          `${i + 1}. ${r.label} (${r.wins}승 ${r.losses}패, 득실 ${r.pf - r.pa > 0 ? "+" : ""}${r.pf - r.pa})`,
      ),
    );

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">리그전 대진 / 결과</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            모두 서로 한 번씩 겨룹니다. 복식은 실력 균형 페어로 자동 구성됩니다.
          </p>
        </div>
        <Button onClick={generate} disabled={pending || locked}>
          <Network className="mr-1 h-4 w-4" /> 대진 생성
        </Button>
      </div>

      {standings.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
              순위 <span className="font-normal">(승 → 직접전 → 득실)</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={copyResult}>
              <Copy className="mr-1 h-3.5 w-3.5" /> 복사
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">팀/선수</th>
                <th className="px-3 py-2 text-center">승-패</th>
                <th className="px-3 py-2 text-center">득실</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-center">
                    {r.wins}-{r.losses}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {r.pf - r.pa > 0 ? "+" : ""}
                    {r.pf - r.pa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {optMatches.length > 0 && (
        <ol className="mt-3 space-y-1">
          {optMatches.map((m) => (
            <MatchRow key={m.id} match={m} disabled={locked} onSave={saveResult} />
          ))}
        </ol>
      )}
    </section>
  );
}
