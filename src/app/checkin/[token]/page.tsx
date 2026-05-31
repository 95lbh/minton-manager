import { CheckinClient } from "@/features/checkin/checkin-client";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata = {
  title: "출석 체크 — 배드민턴 매니저",
};

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!hasSupabaseEnv) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        서버 설정이 필요합니다.
      </main>
    );
  }

  return <CheckinClient token={token} />;
}
