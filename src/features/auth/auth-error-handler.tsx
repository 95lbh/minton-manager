"use client";

import { useEffect } from "react";
import type { Provider } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ROUTES, PENDING_LINK_PROVIDER_KEY } from "@/lib/constants";

/**
 * OAuth 리다이렉트로 돌아온 에러를 전역에서 처리한다(루트 레이아웃에 마운트).
 *
 * Supabase 의 OAuth 에러는 URL 프래그먼트(#error=...) 또는 쿼리(?error=...)로 돌아오며,
 * 프래그먼트는 서버(콜백 라우트)에서 읽을 수 없어 클라이언트에서 처리한다.
 *
 * 특히 익명 → 정식 전환(linkIdentity)에서 "이미 가입된 소셜 계정"이면
 * identity_already_exists 가 오는데, 이 경우 전환 직전 저장해 둔 provider 로
 * signInWithOAuth 를 호출해 **기존 계정 로그인으로 자동 전환**한다.
 */
export function AuthErrorHandler() {
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const search = window.location.search;
    if (!hash.includes("error") && !search.includes("error")) return;

    const params = new URLSearchParams(hash || search);
    const errorCode = params.get("error_code");
    const hasError = !!errorCode || params.has("error");
    if (!hasError) return;

    // 에러 파라미터 제거(새로고침 시 재실행 방지). 경로만 남긴다.
    window.history.replaceState(null, "", window.location.pathname);

    // 이미 가입된 소셜 계정으로 전환 시도 → 기존 계정 로그인으로 자동 전환
    if (errorCode === "identity_already_exists") {
      const provider = sessionStorage.getItem(PENDING_LINK_PROVIDER_KEY);
      sessionStorage.removeItem(PENDING_LINK_PROVIDER_KEY);
      if (provider === "google" || provider === "kakao") {
        toast.message("이미 가입된 계정이에요. 기존 계정으로 로그인할게요.");
        // supabase-js는 무거우므로 이 드문 경로에서만 동적 로드(전역 번들에서 분리).
        void (async () => {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          // 비회원 데이터는 이전되지 않음(기존 계정에 이미 데이터가 있으므로 로그인으로 처리).
          await supabase.auth.signInWithOAuth({
            provider: provider as Provider,
            options: {
              redirectTo: `${window.location.origin}${ROUTES.authCallback}?redirect=${encodeURIComponent(ROUTES.dashboard)}`,
            },
          });
        })();
        return;
      }
      toast.error("이미 가입된 계정이에요. '로그인'으로 다시 시도해 주세요.");
      return;
    }

    // 그 외 로그인 에러
    sessionStorage.removeItem(PENDING_LINK_PROVIDER_KEY);
    toast.error("로그인 중 문제가 발생했어요. 다시 시도해 주세요.");
  }, []);

  return null;
}
