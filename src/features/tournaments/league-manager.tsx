"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateLeague, setMatchResult } from "@/server/mutations/tournaments";
import type { MatchView } from "@/server/queries/tournaments";

function names(side: { id: string; name: string }[]) {
  return side.map((p) => p.name).join(" · ") || "-";
}
function unitKey(side: { id: string; name: string }[]) {
  return side.map((p) => p.id).sort().join("+");
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
      <Input
        type="number"
        min={0}
        value={a}
        onChange={(e) => setA(e.target.value)}
        onBlur={save}
        disabled={pending}
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
        disabled={pending}
        className="h-8 w-14 text-center"
        aria-label="오른쪽 점수"
      />
      <span className={`min-w-0 flex-1 truncate text-right ${bWon ? "font-semibold" : ""}`}>
        {names(match.white)}
      </span>
    </li>
  );
}

export function LeagueManager({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: MatchView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const standings = useMemo(() => {
    type Row = { label: string; played: number; wins: number; losses: number; pf: number; pa: number };
    const units = new Map<string, Row>();
    const reg = (side: { id: string; name: string }[]) => {
      const key = unitKey(side);
      if (!units.has(key)) units.set(key, { label: names(side), played: 0, wins: 0, losses: 0, pf: 0, pa: 0 });
      return key;
    };
    for (const m of matches) {
      const bk = reg(m.blue);
      const wk = reg(m.white);
      if (m.scoreBlue == null || m.scoreWhite == null) continue;
      const ub = units.get(bk)!;
      const uw = units.get(wk)!;
      ub.played++; uw.played++;
      ub.pf += m.scoreBlue; ub.pa += m.scoreWhite;
      uw.pf += m.scoreWhite; uw.pa += m.scoreBlue;
      if (m.scoreBlue > m.scoreWhite) { ub.wins++; uw.losses++; }
      else if (m.scoreWhite > m.scoreBlue) { uw.wins++; ub.losses++; }
    }
    return [...units.values()].sort(
      (a, b) => b.wins - a.wins || b.pf - b.pa - (a.pf - a.pa) || a.label.localeCompare(b.label),
    );
  }, [matches]);

  const generate = () => {
    if (matches.length > 0 && !confirm("다시 생성하면 기존 대진·점수가 새로 만들어집니다. 계속할까요?"))
      return;
    startTransition(async () => {
      const res = await generateLeague(tournamentId);
      if (res.ok) {
        toast.success("리그 대진을 생성했습니다.");
        if (res.data && res.data.excluded > 0) {
          toast.warning(`복식 페어가 안 맞아 ${res.data.excluded}명은 제외됐어요.`);
        }
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const saveResult = (matchId: string, a: number, b: number) => {
    startTransition(async () => {
      const res = await setMatchResult(matchId, tournamentId, a, b);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">리그전 대진 / 결과</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            모두 서로 한 번씩 겨룹니다. 복식은 실력 균형 페어로 자동 구성됩니다.
          </p>
        </div>
        <Button onClick={generate} disabled={pending}>
          <Network className="mr-1 h-4 w-4" /> 대진 생성
        </Button>
      </div>

      {standings.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border">
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
                <tr key={r.label} className="border-t">
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
      )}

      {matches.length > 0 && (
        <ol className="mt-3 space-y-1">
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} pending={pending} onSave={saveResult} />
          ))}
        </ol>
      )}
    </section>
  );
}
