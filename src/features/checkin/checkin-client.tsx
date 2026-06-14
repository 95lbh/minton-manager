"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/person-avatar";
import { createClient } from "@/lib/supabase/client";
import { GENDER_LABEL, GRADE_BY_VALUE } from "@/lib/constants";
import type { CheckinMember } from "@/server/queries/checkin";

/** 비로그인 셀프 체크인: 명단에서 본인 이름 탭 → 확인 → 완료 화면. */
export function CheckinClient({
  token,
  members: initial,
}: {
  token: string;
  members: CheckinMember[];
}) {
  const [members, setMembers] = useState(initial);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<CheckinMember | null>(null);
  const [done, setDone] = useState<{ member: CheckinMember; already: boolean } | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const confirm = () => {
    const m = confirming;
    if (!m || pending) return;
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("self_check_in", {
        _token: token,
        _member_id: m.id,
      });
      if (error) {
        toast.error("출석 처리에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setMembers((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, present: true } : x)),
      );
      setConfirming(null);
      setDone({ member: m, already: data === "already" });
    });
  };

  // 완료 화면 — 회원은 더 머물 필요 없음.
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center shadow-sm">
        <CheckCircle2 className="size-16 text-primary" />
        <div>
          <p className="text-xl font-bold">
            {done.already ? "이미 출석했어요" : "출석 완료!"}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">{done.member.name}</b>님, 오늘도 즐거운
            운동 되세요!
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          이 창은 닫으셔도 됩니다.
        </p>
        <Button variant="outline" size="sm" onClick={() => setDone(null)}>
          다른 사람 출석하기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-sm text-muted-foreground">
        본인 이름을 찾아 눌러주세요
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색"
          aria-label="이름 검색"
          className="pl-9"
        />
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.length === 0 ? (
          <li className="col-span-full py-10 text-center text-sm text-muted-foreground">
            검색 결과가 없습니다.
          </li>
        ) : (
          filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setConfirming(m)}
                className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                  m.present
                    ? "border-primary/40 bg-primary/5"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <PersonAvatar
                  gender={m.gender}
                  label={m.level ? GRADE_BY_VALUE[m.level] : null}
                  className="size-9"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">
                    {m.name}
                  </span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {m.gender ? GENDER_LABEL[m.gender] : ""}
                    {m.level ? ` · ${GRADE_BY_VALUE[m.level]}` : ""}
                  </span>
                </span>
                {m.present && (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                )}
              </button>
            </li>
          ))
        )}
      </ul>

      {/* 본인 확인 */}
      <Dialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>본인이 맞나요?</DialogTitle>
            <DialogDescription>
              <b className="text-foreground">{confirming?.name}</b>님으로 출석합니다.
              {confirming?.present ? " (이미 출석한 상태예요)" : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              disabled={pending}
            >
              취소
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "처리 중…" : "출석하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
