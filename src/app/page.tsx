import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { ROUTES } from "@/lib/constants";
import { GuestStart } from "@/features/auth/guest-start";

/**
 * 첫 진입점. 세션(로그인/익명)이 있으면 대시보드로,
 * 없으면 자동으로 비회원 세션을 만들어 바로 시작한다.
 */
export default async function Home() {
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(ROUTES.dashboard);
  }
  return <GuestStart />;
}
