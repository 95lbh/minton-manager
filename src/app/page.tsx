import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/server/queries/auth";
import { GuestStart } from "@/features/auth/guest-start";

/**
 * 첫 진입점. 세션(로그인/익명)이 있으면 대시보드로,
 * 없으면 자동으로 비회원 세션을 만들어 바로 시작한다.
 */
export default async function Home() {
  if (hasSupabaseEnv) {
    const user = await getCurrentUser();
    if (user) redirect(ROUTES.dashboard);
  }
  return <GuestStart />;
}
