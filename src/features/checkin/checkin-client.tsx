"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/person-avatar";
import { createClient } from "@/lib/supabase/client";
import { GENDER_LABEL, GRADE_BY_VALUE } from "@/lib/constants";
import type { CheckinMember } from "@/server/queries/checkin";

/** 비로그인 셀프 체크인 화면: 명단에서 본인 이름을 탭하면 출석 처리. */
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const checkIn = (m: CheckinMember) => {
    if (m.present || pending) return;
    setBusyId(m.id);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("self_check_in", {
        _token: token,
        _member_id: m.id,
      });
      setBusyId(null);
      if (error) {
        toast.error("출석 처리에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setMembers((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, present: true } : x)),
      );
      toast.success(
        data === "already"
          ? `${m.name}님은 이미 출석했어요.`
          : `${m.name}님 출석 완료!`,
      );
    });
  };

  const presentCount = members.filter((m) => m.present).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>이름을 찾아 눌러주세요</span>
        <span className="tabular-nums">
          출석 {presentCount} / {members.length}
        </span>
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
                onClick={() => checkIn(m)}
                disabled={m.present || busyId === m.id}
                className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-100 ${
                  m.present
                    ? "border-primary/40 bg-primary/5"
                    : "bg-card hover:bg-muted disabled:opacity-50"
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
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
