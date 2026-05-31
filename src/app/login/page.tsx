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
  return <LandingAuth />;
}
