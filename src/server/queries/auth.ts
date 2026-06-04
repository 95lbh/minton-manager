import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * 현재 로그인 사용자(없으면 null).
 * React cache()로 감싸 같은 요청(RSC 렌더) 안에서 여러 번 호출해도
 * Supabase Auth 검증 왕복은 1회만 발생한다(레이아웃 + 페이지 + getMyClubs 중복 제거).
 * ※ 프록시(middleware)는 별도 호출이라 캐시 공유되지 않음.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
