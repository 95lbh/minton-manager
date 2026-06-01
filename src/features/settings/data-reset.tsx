"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetMembers, resetStatsData } from "@/server/mutations/admin";

export function DataResetSettings() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const doResetMembers = () => {
    if (
      !confirm(
        "회원 목록을 모두 비웁니다. (과거 출석·게임 기록은 보존)\n계속할까요?",
      )
    )
      return;
    startTransition(async () => {
      const res = await resetMembers();
      if (res.ok) {
        toast.success(`회원 ${res.data?.count ?? 0}명을 정리했습니다.`);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const doResetData = () => {
    if (
      !confirm(
        "출석·게임 기록(통계)을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.\n(대회 기록은 영향받지 않습니다)\n계속할까요?",
      )
    )
      return;
    startTransition(async () => {
      const res = await resetStatsData();
      if (res.ok) {
        toast.success("출석·게임 데이터를 초기화했습니다.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">데이터 초기화</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        새 시즌 시작 등에 사용합니다. 신중하게 진행하세요.
      </p>
      <div className="mt-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">회원 목록 초기화</p>
            <p className="text-xs text-muted-foreground">
              모든 회원을 목록에서 제거합니다. 과거 기록은 보존됩니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={doResetMembers}
            disabled={pending}
          >
            <Users className="mr-1 h-4 w-4" /> 회원 초기화
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-destructive/15 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">데이터(통계) 초기화</p>
            <p className="text-xs text-muted-foreground">
              출석·게임 기록을 모두 삭제합니다. 되돌릴 수 없습니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={doResetData}
            disabled={pending}
          >
            <Database className="mr-1 h-4 w-4" /> 데이터 초기화
          </Button>
        </div>
      </div>
    </section>
  );
}
