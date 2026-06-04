import { redirect } from "next/navigation";
import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/server/queries/auth";
import { getMyClubs, getActiveClub } from "@/server/queries/clubs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 초기 셋업 전(환경변수 미설정): 설정 안내 화면
  if (!hasSupabaseEnv) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <div className="mt-4 rounded-lg border bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Supabase 설정이 필요합니다.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Supabase 프로젝트 생성</li>
            <li>
              <code>supabase/migrations/0001_init.sql</code> 실행
            </li>
            <li>
              OAuth Provider 활성화 (Google·Kakao) + 익명 로그인 허용
              (Supabase Auth)
            </li>
            <li>
              <code>.env.local</code>에 URL/anon key 입력 후 재시작
            </li>
          </ol>
          <p className="mt-3">
            자세한 내용은 <code>docs/architecture.md</code> 참고.
          </p>
        </div>
        <Link
          href={ROUTES.home}
          className="mt-4 inline-block text-sm underline"
        >
          시작 화면으로
        </Link>
      </main>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(ROUTES.home);
  }

  // 소속 클럽이 없으면 온보딩으로
  const [clubs, activeClub] = await Promise.all([getMyClubs(), getActiveClub()]);
  if (!activeClub) {
    redirect(ROUTES.onboarding);
  }

  const isGuest = user.is_anonymous ?? false;

  return (
    <AppShell
      userEmail={user.email ?? (isGuest ? "체험 사용자" : "")}
      clubs={clubs}
      activeClub={activeClub}
      isGuest={isGuest}
    >
      {children}
    </AppShell>
  );
}
