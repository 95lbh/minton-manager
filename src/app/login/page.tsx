"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") ?? ROUTES.dashboard;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${ROUTES.authCallback}?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          클럽 운영자/스태프 전용 로그인입니다.
        </p>

        {!hasSupabaseEnv && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Supabase 환경변수가 설정되지 않았습니다. <code>.env.local</code> 설정 후
            Google 로그인이 동작합니다.
          </p>
        )}

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={handleGoogleLogin}
          disabled={loading || !hasSupabaseEnv}
        >
          {loading ? "이동 중…" : "Google로 로그인"}
        </Button>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
