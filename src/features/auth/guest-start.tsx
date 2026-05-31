"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClub } from "@/server/mutations/clubs";
import { ROUTES } from "@/lib/constants";

// StrictMode 재마운트/중복 실행 방지(모듈 레벨 가드).
let started = false;

/**
 * 첫 진입 시 자동으로 비회원(익명) 세션을 만들고 기본 클럽을 생성해 대시보드로 이동.
 * 별도 로그인/온보딩 화면 없이 바로 시작한다. (로그인은 상단 배너에서 연동)
 */
export function GuestStart() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started) return;
    started = true;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          const { error: signInErr } = await supabase.auth.signInAnonymously();
          if (signInErr) throw signInErr;
        }

        // 기본 이름으로 클럽 생성(익명이면 createClub이 is_temporary=true 처리). 이후 설정에서 수정.
        const fd = new FormData();
        fd.set("name", "클럽 이름");
        const res = await createClub(fd);
        if (!res.ok) throw new Error(res.error.message);

        window.location.assign(ROUTES.dashboard);
      } catch (e) {
        started = false;
        setError(e instanceof Error ? e.message : "시작하지 못했습니다.");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <a href={ROUTES.login} className="text-sm underline">
            로그인 화면으로
          </a>
        </>
      ) : (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">시작하는 중…</p>
        </>
      )}
    </main>
  );
}
