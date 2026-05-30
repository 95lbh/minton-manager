import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getActiveClub } from "@/server/queries/clubs";
import { CreateClubForm } from "@/features/clubs/create-club-form";

export default async function OnboardingPage() {
  if (!hasSupabaseEnv) redirect(ROUTES.login);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.login);

  // 이미 클럽이 있으면 대시보드로
  const activeClub = await getActiveClub();
  if (activeClub) redirect(ROUTES.dashboard);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          먼저 클럽을 만들어 운영을 시작하세요. 회원·코트·출석·게임은 클럽
          단위로 관리됩니다.
        </p>
        <div className="mt-6">
          <CreateClubForm />
        </div>
      </div>
    </main>
  );
}
