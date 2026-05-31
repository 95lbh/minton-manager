"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autoSplitTeams, setParticipantTeam } from "@/server/mutations/tournaments";
import { DEFAULT_LEVEL } from "@/server/services/team-split";
import { GRADE_BY_VALUE, GENDER_LABEL, TEAM_LABEL } from "@/lib/constants";
import type { TournamentParticipant, TournamentTeam } from "@/types/db";

function summarize(ps: TournamentParticipant[]) {
  const count = ps.length;
  const male = ps.filter((p) => p.gender === "male").length;
  const female = ps.filter((p) => p.gender === "female").length;
  const sum = ps.reduce((s, p) => s + (p.level ?? DEFAULT_LEVEL), 0);
  return { count, male, female, avg: count ? Math.round((sum / count) * 10) / 10 : 0 };
}

function TeamCard({
  team,
  participants,
}: {
  team: TournamentTeam;
  participants: TournamentParticipant[];
}) {
  const s = summarize(participants);
  const tone =
    team === "blue"
      ? "border-sky-400 bg-sky-100 text-sky-900"
      : "border-rose-400 bg-rose-100 text-rose-900";
  return (
    <div className={`rounded-lg border-2 p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{TEAM_LABEL[team]}</span>
        <span className="text-xs opacity-80">
          {s.count}명 · 남{s.male}·여{s.female} · 평균 Lv {s.avg || "-"}
        </span>
      </div>
    </div>
  );
}

export function TeamSplitManager({
  tournamentId,
  participants,
}: {
  tournamentId: string;
  participants: TournamentParticipant[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const blue = useMemo(() => participants.filter((p) => p.team === "blue"), [participants]);
  const white = useMemo(() => participants.filter((p) => p.team === "white"), [participants]);
  const unassigned = participants.filter((p) => !p.team).length;

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    msg: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (msg) toast.success(msg);
        router.refresh();
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  const move = (p: TournamentParticipant, team: TournamentTeam) => {
    const next = p.team === team ? null : team; // 같은 팀 다시 누르면 해제
    run(() => setParticipantTeam(p.id, tournamentId, next), "");
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">청팀/백팀 편성</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            성비·실력을 고르게 자동 분배하거나, 각 참가자를 직접 옮기세요.
            {unassigned > 0 && ` (미배정 ${unassigned}명)`}
          </p>
        </div>
        <Button onClick={() => run(() => autoSplitTeams(tournamentId), "자동 편성했습니다.")} disabled={pending}>
          <Shuffle className="mr-1 h-4 w-4" /> 자동 편성
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <TeamCard team="blue" participants={blue} />
        <TeamCard team="white" participants={white} />
      </div>

      {participants.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">참가자를 먼저 등록하세요.</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {participants.map((p) => {
            const edge =
              p.team === "blue"
                ? "border-l-4 border-l-sky-500"
                : p.team === "white"
                  ? "border-l-4 border-l-rose-500"
                  : "border-l-4 border-l-transparent";
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 ${edge}`}
              >
                <span className="truncate text-sm">
                  {p.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {p.gender ? GENDER_LABEL[p.gender] : ""}
                    {p.level ? ` · ${GRADE_BY_VALUE[p.level]}` : ""}
                  </span>
                </span>
                <div className="flex shrink-0 gap-1">
                  {(["blue", "white"] as const).map((t) => {
                    const active = p.team === t;
                    const activeClass =
                      t === "blue"
                        ? "bg-sky-600 text-white hover:bg-sky-700 border-sky-600"
                        : "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
                    return (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={active ? activeClass : ""}
                        onClick={() => move(p, t)}
                        disabled={pending}
                      >
                        {TEAM_LABEL[t]}
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
