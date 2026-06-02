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
  checkInMember,
  addGuest,
  removeRecord,
} from "@/server/mutations/attendance";
import { GENDER_LABEL, GRADE_BY_VALUE, SKILL_VALUE } from "@/lib/constants";
import { PersonAvatar } from "@/components/person-avatar";
import type { AttendanceSession, ClubMember } from "@/types/db";
import type { AttendanceRecordView } from "@/server/queries/attendance";

export function AttendanceManager({
  session,
  members,
  records,
}: {
  session: AttendanceSession;
  members: ClubMember[];
  records: AttendanceRecordView[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState<GenderValue>("none");
  const [guestLevel, setGuestLevel] = useState<GradeValue>("none");
  const [pending, startTransition] = useTransition();

  // 이미 출석한 회원 id 집합
  const attendedMemberIds = useMemo(
    () => new Set(records.filter((r) => r.member_id).map((r) => r.member_id)),
    [records],
  );

  // 출석 후보(미출석 회원) — 검색 필터
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !attendedMemberIds.has(m.id))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [members, attendedMemberIds, query]);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMsg: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (successMsg) toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  const memberCount = records.filter((r) => !r.is_guest).length;
  const guestCount = records.filter((r) => r.is_guest).length;

  const submitGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("게스트 이름을 입력하세요.");
      return;
    }
    run(
      () =>
        addGuest(session.id, {
          name: guestName,
          gender: guestGender === "none" ? null : guestGender,
          level: guestLevel === "none" ? null : SKILL_VALUE[guestLevel],
        }),
      "게스트를 추가했습니다.",
    );
    setGuestName("");
    setGuestGender("none");
    setGuestLevel("none");
  };

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
        <span className="text-muted-foreground">출석</span>
        <span className="text-xl font-bold tabular-nums text-primary">
          {records.length}
        </span>
        <span className="text-muted-foreground">명</span>
        <span className="ml-auto text-xs text-muted-foreground">
          회원 {memberCount} · 게스트 {guestCount}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 출석자 목록 */}
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-tight">
            출석한 사람 ({records.length})
          </h2>
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              아직 출석한 사람이 없습니다.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {records.map((r) => {
                const name = r.is_guest ? r.guest_name : r.member?.name;
                const gender = r.is_guest ? r.guest_gender : r.member?.gender;
                const level = r.is_guest ? r.guest_level : r.member?.level;
                const grade = level ? GRADE_BY_VALUE[level] : null;
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <PersonAvatar
                        gender={gender}
                        label={grade}
                        className="size-8"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {name}
                          {r.is_guest && (
                            <span className="ml-1 text-xs font-medium text-amber-600">
                              게스트
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] leading-tight text-muted-foreground">
                          {gender ? GENDER_LABEL[gender] : ""}
                          {grade ? ` · ${grade}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => removeRecord(r.id), "출석을 취소했습니다.")
                      }
                      className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                      aria-label="출석 취소"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 출석 추가 */}
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-tight">
            회원 출석 체크
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="회원 이름 검색"
              className="pl-9"
            />
          </div>

          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {candidates.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                {members.length === attendedMemberIds.size
                  ? "모든 회원이 출석했습니다."
                  : "검색 결과가 없습니다."}
              </li>
            ) : (
              candidates.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => checkInMember(session.id, m.id), `${m.name} 출석`)
                    }
                    className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <PersonAvatar
                      gender={m.gender}
                      label={m.level ? GRADE_BY_VALUE[m.level] : null}
                      className="size-8"
                    />
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {m.gender ? GENDER_LABEL[m.gender] : ""}
                      {m.level ? ` · ${GRADE_BY_VALUE[m.level]}` : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>

          {/* 게스트 추가 */}
          <div className="mt-6 rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">게스트 추가</h3>
            <form onSubmit={submitGuest} className="space-y-3">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="비회원 이름 *"
                maxLength={30}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">성별</Label>
                <GenderToggle
                  value={guestGender}
                  onChange={setGuestGender}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">등급</Label>
                <GradeToggle
                  value={guestLevel}
                  onChange={setGuestLevel}
                  disabled={pending}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={pending} className="w-full">
                <UserPlus className="size-4" />게스트 추가
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
