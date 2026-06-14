import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { getCheckinRoster } from "@/server/queries/checkin";
import { CheckinClient } from "@/features/checkin/checkin-client";

// 세션별 임시 링크라 검색 색인 대상이 아니다.
export const metadata: Metadata = {
  title: "출석 체크 — 마이민턴",
  robots: { index: false, follow: false },
};

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-muted/20">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-primary">마이민턴 출석</p>
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const roster = await getCheckinRoster(token);

  if (!roster) {
    return (
      <Shell title="유효하지 않은 링크">
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          출석 링크가 유효하지 않거나 만료되었습니다.
          <br />
          관리자에게 새 QR을 요청해 주세요.
        </p>
      </Shell>
    );
  }

  if (roster.status !== "open") {
    return (
      <Shell title={roster.clubName}>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-8 text-center text-sm text-amber-900">
          현재 출석이 마감되었습니다. 관리자에게 문의해 주세요.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={roster.clubName}>
      <CheckinClient token={token} members={roster.members} />
    </Shell>
  );
}
