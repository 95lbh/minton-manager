"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * 랜딩의 시작/로그인 카드.
 * 기본 동작은 "비회원으로 바로 시작"(익명 로그인)이고, Google/Kakao 로그인은 보조.
 * 페이지 헤드라인/브랜드는 랜딩 페이지(page.tsx)가 담당 → 여기선 카드만 렌더.
 */
export function LandingAuth() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = loading !== null || guestLoading;

  // 비회원(익명) 체험: 로그인 없이 임시 클럽으로 바로 시작.
  const handleGuestStart = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      window.location.assign(ROUTES.onboarding);
    } catch (e) {
      setError(e instanceof Error ? e.message : "체험 모드를 시작하지 못했습니다.");
      setGuestLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: Provider) => {
    setError(null);
    setLoading(provider);
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") ?? ROUTES.dashboard;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${ROUTES.authCallback}?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      setLoading(null);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-sm">
      <p className="text-sm font-semibold">지금 바로 시작하기</p>
      <p className="mt-1 text-xs text-muted-foreground">
        설치·가입 없이 1초 만에. 데이터는 나중에 로그인하면 정식 클럽으로 전환돼요.
      </p>

      {!hasSupabaseEnv && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          Supabase 환경변수가 설정되지 않았습니다. <code>.env.local</code> 설정 후
          로그인/시작이 동작합니다.
        </p>
      )}

      {/* 기본: 비회원으로 바로 시작 */}
      <Button
        className="mt-5 w-full"
        size="lg"
        onClick={handleGuestStart}
        disabled={busy || !hasSupabaseEnv}
      >
        {guestLoading ? "준비 중…" : "비회원으로 바로 시작"}
      </Button>

      {/* 보조: 소셜 로그인 */}
      <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        로그인 / 연동
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-4 space-y-3">
        <Button
          className="w-full"
          size="lg"
          variant="outline"
          onClick={() => handleOAuthLogin("google")}
          disabled={busy || !hasSupabaseEnv}
        >
          {loading === "google" ? "이동 중…" : "Google로 로그인"}
        </Button>

        <Button
          className="w-full bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
          size="lg"
          onClick={() => handleOAuthLogin("kakao")}
          disabled={busy || !hasSupabaseEnv}
        >
          {loading === "kakao" ? "이동 중…" : "카카오로 로그인"}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
