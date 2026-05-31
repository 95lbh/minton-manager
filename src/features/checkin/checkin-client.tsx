"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, UserPlus, ArrowLeft, Check, PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderToggle, type GenderValue } from "@/components/ui/gender-toggle";
import { GradeToggle, type GradeValue } from "@/components/ui/grade-toggle";
import {
  APP_NAME,
  GENDER_LABEL,
  GRADE_BY_VALUE,
  SKILL_VALUE,
} from "@/lib/constants";

type View = "search" | "newMember" | "guest" | "done";

interface SearchRow {
  id: string;
  name: string;
  gender: "male" | "female" | "other" | null;
  level: number | null;
  attended: boolean;
}

export function CheckinClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [clubName, setClubName] = useState("");

  const [view, setView] = useState<View>("search");
  const [doneName, setDoneName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("checkin_session_info", {
        _token: token,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.valid) {
        setValid(true);
        setClubName(row.club_name ?? "");
      }
      setLoading(false);
    })();
  }, [supabase, token]);

  if (loading) {
    return (
      <Center>
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </Center>
    );
  }

  if (!valid) {
    return (
      <Center>
        <div className="text-center">
          <h1 className="text-xl font-bold">출석을 받을 수 없어요</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            QR/링크가 만료되었거나 오늘 출석이 마감되었습니다.
            <br />
            관리자에게 문의해 주세요.
          </p>
        </div>
      </Center>
    );
  }

  if (view === "done") {
    return (
      <Center>
        <div className="text-center">
          <PartyPopper className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">출석 완료!</h1>
          <p className="mt-1 text-lg">{doneName} 님</p>
          <p className="mt-2 text-sm text-muted-foreground">
            즐거운 운동 되세요 🏸
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setView("search")}
          >
            다른 사람 출석하기
          </Button>
        </div>
      </Center>
    );
  }

  const onDone = (name: string) => {
    setDoneName(name);
    setView("done");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-bold">{clubName} 출석</h1>
      </header>

      {view === "search" && (
        <SearchView
          supabase={supabase}
          token={token}
          pending={pending}
          startTransition={startTransition}
          onDone={onDone}
          goNew={() => setView("newMember")}
          goGuest={() => setView("guest")}
        />
      )}

      {view === "newMember" && (
        <RegisterView
          mode="member"
          supabase={supabase}
          token={token}
          pending={pending}
          startTransition={startTransition}
          onDone={onDone}
          onBack={() => setView("search")}
        />
      )}

      {view === "guest" && (
        <RegisterView
          mode="guest"
          supabase={supabase}
          token={token}
          pending={pending}
          startTransition={startTransition}
          onDone={onDone}
          onBack={() => setView("search")}
        />
      )}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      {children}
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function SearchView({
  supabase,
  token,
  pending,
  startTransition,
  onDone,
  goNew,
  goGuest,
}: {
  supabase: SB;
  token: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onDone: (name: string) => void;
  goNew: () => void;
  goGuest: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setRows([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("checkin_search_members", {
        _token: token,
        _q: term,
      });
      if (!error && Array.isArray(data)) setRows(data as SearchRow[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, supabase, token]);

  const checkIn = (row: SearchRow) => {
    if (row.attended) return;
    startTransition(async () => {
      const { data, error } = await supabase.rpc("checkin_member", {
        _token: token,
        _member_id: row.id,
      });
      if (error) {
        toast.error("출석에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      onDone((data as string) ?? row.name);
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름을 입력하세요"
          className="h-12 pl-10 text-base"
          autoFocus
        />
      </div>

      <div className="mt-3 flex-1">
        {q.trim().length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            이름을 검색해 본인을 찾아 출석하세요.
          </p>
        ) : searching ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            검색 중…
          </p>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </p>
            <Button variant="outline" className="mt-3" onClick={goNew}>
              <UserPlus className="size-4" />처음 오셨나요? 회원 등록
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={r.attended || pending}
                  onClick={() => checkIn(r)}
                  className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors enabled:hover:bg-muted disabled:opacity-50"
                >
                  <div>
                    <div className="text-lg font-semibold">{r.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {r.gender ? GENDER_LABEL[r.gender] : ""}
                      {r.level ? ` · ${GRADE_BY_VALUE[r.level]}` : ""}
                    </div>
                  </div>
                  {r.attended ? (
                    <span className="flex items-center gap-1 text-sm text-primary">
                      <Check className="size-4" />출석됨
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-primary">
                      출석하기
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
        <Button variant="outline" onClick={goNew}>
          <UserPlus className="size-4" />신규 회원
        </Button>
        <Button variant="outline" onClick={goGuest}>
          게스트로 출석
        </Button>
      </div>
    </div>
  );
}

function RegisterView({
  mode,
  supabase,
  token,
  pending,
  startTransition,
  onDone,
  onBack,
}: {
  mode: "member" | "guest";
  supabase: SB;
  token: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onDone: (name: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderValue>("none");
  const [level, setLevel] = useState<GradeValue>("none");

  const submit = () => {
    if (!name.trim()) {
      toast.error("이름을 입력하세요.");
      return;
    }
    const fn = mode === "member" ? "checkin_new_member" : "checkin_guest";
    startTransition(async () => {
      const { data, error } = await supabase.rpc(fn, {
        _token: token,
        _name: name.trim(),
        _gender: gender === "none" ? null : gender,
        _level: level === "none" ? null : SKILL_VALUE[level],
      });
      if (error) {
        toast.error("등록에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      onDone((data as string) ?? name.trim());
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />뒤로
      </button>

      <h2 className="text-lg font-bold">
        {mode === "member" ? "신규 회원 등록" : "게스트 출석"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "member"
          ? "정보를 입력하면 회원으로 등록되고 출석됩니다."
          : "오늘 1회 게스트로 출석합니다."}
      </p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ci-name">이름 *</Label>
          <Input
            id="ci-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 text-base"
            autoFocus
            maxLength={30}
          />
        </div>
        <div className="space-y-2">
          <Label>성별</Label>
          <GenderToggle value={gender} onChange={setGender} disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label>등급</Label>
          <GradeToggle value={level} onChange={setLevel} disabled={pending} />
        </div>
      </div>

      <Button
        className="mt-8 h-12 text-base"
        onClick={submit}
        disabled={pending}
      >
        {pending ? "처리 중…" : "출석하기"}
      </Button>
    </div>
  );
}
