"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { seedSampleData } from "@/server/mutations/admin";

/** 빈 클럽에서 샘플 회원·코트를 한 번에 생성해 둘러보게 한다. */
export function SampleDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      const res = await seedSampleData();
      if (res.ok) {
        toast.success(
          `샘플 회원 ${res.data?.members ?? 0}명·코트 ${res.data?.courts ?? 0}개를 만들었어요.`,
        );
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      샘플 데이터로 먼저 둘러보기
    </button>
  );
}
