"use client";

import { useMemo, useOptimistic, useState } from "react";
import { useServerAction } from "@/hooks/use-server-action";
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
import type { ClubMember, MemberGender, TournamentParticipant } from "@/types/db";

/** 성별 카드 테두리: 남=하늘, 여=장미, 그 외=기본. */
function genderBorder(gender: MemberGender | null): string {
  if (gender === "male") return "border-sky-400";
  if (gender === "female") return "border-rose-400";
  return "";
}

// 낙관적 참가자 목록 갱신(서버 응답 전 즉시 반영, 이후 revalidate로 동기화).
type PAction =
  | { type: "add"; participant: TournamentParticipant }
  | { type: "remove"; id: string };
function reducer(
  state: TournamentParticipant[],
  action: PAction,
): TournamentParticipant[] {
  if (action.type === "add") return [...state, action.participant];
  return state.filter((p) => p.id !== action.id);
}

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
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState<GenderValue>("none");
  const [guestLevel, setGuestLevel] = useState<GradeValue>("none");
  const { pending, run: runAction } = useServerAction();
  const [optParticipants, apply] = useOptimistic(participants, reducer);
  const disabled = pending || locked;

  const registeredMemberIds = useMemo(
    () => new Set(optParticipants.filter((p) => p.member_id).map((p) => p.member_id)),
    [optParticipants],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !registeredMemberIds.has(m.id))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [members, registeredMemberIds, query]);

  // 회원에서 추가 — 낙관적으로 즉시 카드 추가(출석 체크인처럼 빠르게).
  const addMember = (m: ClubMember) =>
    runAction(
      () =>
        addParticipantsFromMembers(tournamentId, [
          { id: m.id, name: m.name, gender: m.gender, level: m.level },
        ]),
      {
        optimistic: () =>
          apply({
            type: "add",
            participant: {
              id: `temp-${m.id}`,
              club_id: "",
              tournament_id: tournamentId,
              member_id: m.id,
              name: m.name,
              gender: m.gender,
              level: m.level,
              team: null,
              seed: null,
              created_at: new Date().toISOString(),
            },
          }),
      },
    );

  const submitGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) {
      toast.error("참가자 이름을 입력하세요.");
      return;
    }
    const gender = guestGender === "none" ? null : guestGender;
    const level = guestLevel === "none" ? null : SKILL_VALUE[guestLevel];
    setGuestName("");
    setGuestGender("none");
    setGuestLevel("none");
    runAction(() => addGuestParticipant(tournamentId, { name, gender, level }), {
      optimistic: () =>
        apply({
          type: "add",
          participant: {
            id: `temp-guest-${Date.now()}`,
            club_id: "",
            tournament_id: tournamentId,
            member_id: null,
            name,
            gender,
            level,
            team: null,
            seed: null,
            created_at: new Date().toISOString(),
          },
        }),
    });
  };

  const removeP = (id: string) =>
    runAction(() => removeParticipant(id, tournamentId), {
      optimistic: () => apply({ type: "remove", id }),
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 등록된 참가자 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          참가자 ({optParticipants.length})
        </h2>
        {optParticipants.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            아직 참가자가 없습니다. 오른쪽에서 추가하세요.
          </p>
        ) : (
          <ul className="space-y-1">
            {optParticipants.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-lg border-2 bg-card px-3 py-2 ${genderBorder(p.gender)}`}
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
                  onClick={() => removeP(p.id)}
                  disabled={locked}
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
                    onClick={() => addMember(m)}
                    disabled={locked}
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
