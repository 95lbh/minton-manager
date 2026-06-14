"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createTournament } from "@/server/mutations/tournaments";
import {
  ROUTES,
  TOURNAMENT_STATUS_LABEL,
  MATCH_TYPE_LABEL,
} from "@/lib/constants";
import type { Tournament, TournamentMatchType } from "@/types/db";

export function TournamentsManager({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [matchType, setMatchType] = useState<TournamentMatchType>("doubles");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("대회 이름을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const res = await createTournament(name.trim(), matchType);
      if (res.ok && res.data) {
        toast.success("대회를 만들었습니다.");
        setName("");
        setMatchType("doubles");
        setOpen(false);
        router.push(`${ROUTES.tournaments}/${res.data.id}`);
      } else if (!res.ok) {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> 대회 만들기
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Trophy className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            아직 만든 대회가 없습니다.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 첫 대회 만들기
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`${ROUTES.tournaments}/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MATCH_TYPE_LABEL[t.match_type]}
                  </p>
                </div>
                <Badge variant="secondary">
                  {TOURNAMENT_STATUS_LABEL[t.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대회 만들기</DialogTitle>
            <DialogDescription>대회 이름과 경기 형식을 정하세요.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tournament-name">대회 이름</Label>
              <Input
                id="tournament-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex) 1분기 정기 대회"
                autoFocus
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>경기 형식</Label>
              <div className="flex gap-2">
                {(["doubles", "singles"] as const).map((mt) => (
                  <Button
                    key={mt}
                    type="button"
                    variant={matchType === mt ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setMatchType(mt)}
                  >
                    {MATCH_TYPE_LABEL[mt]}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                취소
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "만드는 중…" : "만들기"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
