import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { ROUTES } from "@/lib/constants";
import { LandingAuth } from "@/features/auth/landing-auth";

/**
 * 첫 진입점. 로그인/익명 세션이 있으면 대시보드로, 없으면 랜딩(비회원 시작 기본).
 */
export default async function Home() {
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(ROUTES.dashboard);
  }
  return <LandingAuth />;
}
