"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

/**
 * 비회원(익명) → 정식 계정 전환 버튼(Google/Kakao).
 * 현재 익명 계정에 소셜 신원을 연결(linkIdentity)하므로 데이터가 유지된 채 전환된다.
 * 배너/넛지 등 여러 곳에서 재사용.
 */
export function UpgradeButtons() {
  const [loading, setLoading] = useState<Provider | null>(null);

  const upgrade = async (provider: Provider) => {
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
      toast.error(e instanceof Error ? e.message : "정식 전환에 실패했습니다.");
      setLoading(null);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="bg-white"
        onClick={() => upgrade("google")}
        disabled={loading !== null}
      >
        {loading === "google" ? "이동 중…" : "Google로 전환"}
      </Button>
      <Button
        size="sm"
        className="bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
        onClick={() => upgrade("kakao")}
        disabled={loading !== null}
      >
        {loading === "kakao" ? "이동 중…" : "카카오로 전환"}
      </Button>
    </div>
  );
}
