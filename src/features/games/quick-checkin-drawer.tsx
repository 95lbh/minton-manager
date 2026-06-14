"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, X, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/person-avatar";
import { CheckinQr } from "@/features/attendance/checkin-qr";
import { checkInMember } from "@/server/mutations/attendance";
import { GENDER_LABEL, GRADE_BY_VALUE } from "@/lib/constants";
import type { ClubMember } from "@/types/db";

/**
 * 코트/게임 화면에서 출석 탭으로 가지 않고도 회원을 출석시키는 접이식 사이드 패널.
 * QR 셀프 출석 버튼도 포함. 체크인 후 router.refresh로 대기자 목록이 갱신된다.
 */
export function QuickCheckinDrawer({
  sessionId,
  clubId,
  checkinToken,
  members,
  attendedMemberIds,
}: {
  sessionId: string;
  clubId: string;
  checkinToken: string;
  members: ClubMember[];
  attendedMemberIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  // 방금 체크인한 회원(서버 갱신 전 즉시 목록에서 제거).
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const attended = useMemo(
    () => new Set([...attendedMemberIds, ...justAdded]),
    [attendedMemberIds, justAdded],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !attended.has(m.id))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [members, attended, query]);

  const checkIn = (m: ClubMember) => {
    if (pending) return;
    setBusyId(m.id);
    startTransition(async () => {
      const res = await checkInMember(sessionId, m.id, clubId);
      setBusyId(null);
      if (res.ok) {
        setJustAdded((prev) => new Set(prev).add(m.id));
        toast.success(`${m.name} 출석`);
        router.refresh(); // 대기자 목록 갱신
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <>
      {/* 우측 가장자리 토글 탭 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/3 z-30 flex items-center gap-1 rounded-l-xl border border-r-0 bg-primary py-3 pl-2 pr-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-x-0.5"
        aria-label="빠른 출석 열기"
      >
        <ChevronLeft className="size-4" />
        <span className="[writing-mode:vertical-rl]">빠른 출석</span>
      </button>

      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* 패널 */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-sm flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-bold">빠른 출석</h2>
          <div className="flex items-center gap-1.5">
            <CheckinQr token={checkinToken} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="회원 이름 검색"
              aria-label="회원 이름 검색"
              className="pl-9"
            />
          </div>
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto p-3">
          {candidates.length === 0 ? (
            <li className="py-10 text-center text-sm text-muted-foreground">
              {members.length === attended.size
                ? "모든 회원이 출석했습니다."
                : "검색 결과가 없습니다."}
            </li>
          ) : (
            candidates.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => checkIn(m)}
                  disabled={busyId === m.id}
                  className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <PersonAvatar
                    gender={m.gender}
                    label={m.level ? GRADE_BY_VALUE[m.level] : null}
                    className="size-8"
                  />
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {m.gender ? GENDER_LABEL[m.gender] : ""}
                      {m.level ? ` · ${GRADE_BY_VALUE[m.level]}` : ""}
                    </span>
                    <UserPlus className="size-4 text-primary" />
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}
