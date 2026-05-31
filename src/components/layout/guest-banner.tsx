"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

/**
 * 체험(비회원) 모드 안내 배너.
 * 현재 익명 계정에 소셜 계정을 연결(linkIdentity)하면 데이터를 유지한 채
 * 정식 클럽으로 전환된다. (연결 완료는 콜백에서 처리)
 */
export function GuestBanner() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (provider: Provider) => {
    setError(null);
    setLoading(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}${ROUTES.authCallback}?redirect=${encodeURIComponent(ROUTES.dashboard)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "정식 전환에 실패했습니다.");
      setLoading(null);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <b>비회원 모드</b> — 일회성 클럽으로 운영 중입니다. 데이터 보관·통계는 제한될
          수 있어요. 로그인하여 정식 클럽으로 전환하세요.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => handleUpgrade("google")}
            disabled={loading !== null}
          >
            {loading === "google" ? "이동 중…" : "Google로 전환"}
          </Button>
          <Button
            size="sm"
            className="bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
            onClick={() => handleUpgrade("kakao")}
            disabled={loading !== null}
          >
            {loading === "kakao" ? "이동 중…" : "카카오로 전환"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="mx-auto max-w-6xl px-4 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
