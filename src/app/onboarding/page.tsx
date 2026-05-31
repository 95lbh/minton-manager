import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getActiveClub } from "@/server/queries/clubs";
import { CreateClubForm } from "@/features/clubs/create-club-form";

export default async function OnboardingPage() {
  if (!hasSupabaseEnv) redirect(ROUTES.home);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.home);

  // 이미 클럽이 있으면 대시보드로
  const activeClub = await getActiveClub();
  if (activeClub) redirect(ROUTES.dashboard);

  const isGuest = user.is_anonymous ?? false;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        {isGuest ? (
          <p className="mt-2 text-sm text-muted-foreground">
            즉석으로 클럽을 만들어 바로 운영해보세요. 데이터는
            임시로 저장되며, 나중에 로그인하면 정식 클럽으로 전환할 수 있어요.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            먼저 클럽을 만들어 운영을 시작하세요. 회원·코트·출석·게임은 클럽
            단위로 관리됩니다.
          </p>
        )}
        <div className="mt-6">
          <CreateClubForm isGuest={isGuest} />
        </div>
      </div>
    </main>
  );
}
