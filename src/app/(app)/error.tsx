"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

/**
 * 운영 화면(대시보드/출석/코트/통계/대회/설정) 렌더 오류 바운더리.
 * 흰 화면 대신 안내 + 재시도/대시보드 이동. 오류는 콘솔로 남긴다.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" />
      </span>
      <div>
        <h1 className="text-lg font-bold">문제가 발생했어요</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          일시적인 오류일 수 있어요. 다시 시도해 주세요.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground/70">
            오류 코드: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>다시 시도</Button>
        <Link
          href={ROUTES.dashboard}
          className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          대시보드로
        </Link>
      </div>
    </div>
  );
}
