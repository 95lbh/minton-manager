import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { ROUTES } from "@/lib/constants";
import { LandingAuth } from "@/features/auth/landing-auth";

/** 명시적 로그인 화면(Google/Kakao). 세션이 있으면 대시보드로. */
export default async function LoginPage() {
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(ROUTES.dashboard);
  }
  // LandingAuth는 카드만 렌더하므로(랜딩 페이지가 레이아웃 담당), 여기선 중앙 정렬해 감싼다.
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <LandingAuth />
    </main>
  );
}
