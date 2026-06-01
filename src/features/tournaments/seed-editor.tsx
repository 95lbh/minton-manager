"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSeedOrder } from "@/server/mutations/tournaments";
import { GRADE_BY_VALUE, GENDER_LABEL } from "@/lib/constants";
import { DEFAULT_LEVEL } from "@/server/services/team-split";
import type { TournamentParticipant } from "@/types/db";

export function SeedEditor({
  tournamentId,
  participants,
  isDoubles,
  locked = false,
}: {
  tournamentId: string;
  participants: TournamentParticipant[];
  isDoubles: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const disabled = pending || locked;

  // 시드 순(미지정은 실력 높은 순으로 뒤에)
  const ordered = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
        const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
        return (
          sa - sb ||
          (b.level ?? DEFAULT_LEVEL) - (a.level ?? DEFAULT_LEVEL) ||
          a.name.localeCompare(b.name)
        );
      }),
    [participants],
  );

  const save = (ids: string[]) => {
    startTransition(async () => {
      const res = await setSeedOrder(tournamentId, ids);
      if (res.ok) router.refresh();
      else toast.error(res.error.message);
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= ordered.length) return;
    const ids = ordered.map((p) => p.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    save(ids);
  };

  if (participants.length < 2) return null;

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">시드 순서</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        위에 있을수록 상위 시드(강한 자리)입니다. 화살표로 순서를 조정하면 대진 생성 시 반영됩니다.
        {isDoubles && " 복식은 페어 자동 구성 후 시드 합으로 배치됩니다."}
      </p>
      <ol className="mt-3 space-y-1">
        {ordered.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <span className="truncate">
              <span className="mr-2 text-xs text-muted-foreground">{i + 1}</span>
              {p.name}
              <span className="ml-1 text-xs text-muted-foreground">
                {p.gender ? GENDER_LABEL[p.gender] : ""}
                {p.level ? ` · ${GRADE_BY_VALUE[p.level]}` : ""}
              </span>
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => move(i, -1)}
                disabled={disabled || i === 0}
                aria-label="위로"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => move(i, 1)}
                disabled={disabled || i === ordered.length - 1}
                aria-label="아래로"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
