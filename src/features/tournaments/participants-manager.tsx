"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderToggle, type GenderValue } from "@/components/ui/gender-toggle";
import { GradeToggle, type GradeValue } from "@/components/ui/grade-toggle";
import {
  addParticipantsFromMembers,
  addGuestParticipant,
  removeParticipant,
} from "@/server/mutations/tournaments";
import { SKILL_VALUE, GRADE_BY_VALUE, GENDER_LABEL } from "@/lib/constants";
import type { ClubMember, TournamentParticipant } from "@/types/db";

export function ParticipantsManager({
  tournamentId,
  participants,
  members,
  locked = false,
}: {
  tournamentId: string;
  participants: TournamentParticipant[];
  members: ClubMember[];
  locked?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState<GenderValue>("none");
  const [guestLevel, setGuestLevel] = useState<GradeValue>("none");
  const [pending, startTransition] = useTransition();
  const disabled = pending || locked;

  const registeredMemberIds = useMemo(
    () => new Set(participants.filter((p) => p.member_id).map((p) => p.member_id)),
    [participants],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !registeredMemberIds.has(m.id))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [members, registeredMemberIds, query]);

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) => {
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

  const submitGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("참가자 이름을 입력하세요.");
      return;
    }
    run(
      () =>
        addGuestParticipant(tournamentId, {
          name: guestName,
          gender: guestGender === "none" ? null : guestGender,
          level: guestLevel === "none" ? null : SKILL_VALUE[guestLevel],
        }),
      "참가자를 추가했습니다.",
    );
    setGuestName("");
    setGuestGender("none");
    setGuestLevel("none");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 등록된 참가자 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          참가자 ({participants.length})
        </h2>
        {participants.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            아직 참가자가 없습니다. 오른쪽에서 추가하세요.
          </p>
        ) : (
          <ul className="space-y-1">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <span className="truncate text-sm">
                  {p.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {p.gender ? GENDER_LABEL[p.gender] : ""}
                    {p.level ? ` · ${GRADE_BY_VALUE[p.level]}` : ""}
                    {!p.member_id ? " · 게스트" : ""}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => run(() => removeParticipant(p.id, tournamentId), "")}
                  disabled={disabled}
                  aria-label="참가자 제거"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 추가 */}
      <section className="space-y-5">
        {/* 회원에서 추가 */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            회원에서 추가
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 검색"
              aria-label="참가자 이름 검색"
              className="pl-8"
            />
          </div>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {candidates.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                추가할 회원이 없습니다.
              </li>
            ) : (
              candidates.map((m) => (
                <li key={m.id}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      run(
                        () =>
                          addParticipantsFromMembers(tournamentId, [
                            { id: m.id, name: m.name, gender: m.gender, level: m.level },
                          ]),
                        `${m.name} 추가`,
                      )
                    }
                    disabled={disabled}
                  >
                    <UserPlus className="mr-1 h-4 w-4" /> {m.name}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 게스트(신규) 추가 — 이름 + 성별 + 급수 */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-3 text-sm font-semibold">게스트 참가자</h3>
          <form onSubmit={submitGuest} className="space-y-3">
            <Input
              id="guest-participant"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="참가자 이름 *"
              maxLength={30}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">성별</Label>
              <GenderToggle value={guestGender} onChange={setGuestGender} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">등급</Label>
              <GradeToggle value={guestLevel} onChange={setGuestLevel} disabled={disabled} />
            </div>
            <Button type="submit" variant="secondary" disabled={disabled} className="w-full">
              <UserPlus className="size-4" /> 참가자 추가
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
