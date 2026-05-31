"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCourtCount } from "@/server/mutations/courts";
import type { Court } from "@/types/db";

const MAX_COURTS = 20;

export function CourtsManager({ courts }: { courts: Court[] }) {
  const router = useRouter();
  const [count, setCount] = useState(Math.max(1, courts.length));
  const [pending, startTransition] = useTransition();

  const changed = count !== courts.length;

  const apply = () => {
    startTransition(async () => {
      const res = await setCourtCount(count);
      if (res.ok) {
        toast.success("코트 개수를 저장했습니다.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="max-w-sm">
      <div className="rounded-xl border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">코트 개수</p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            disabled={pending || count <= 1}
            aria-label="코트 줄이기"
          >
            <Minus className="size-5" />
          </Button>
          <span className="w-14 text-center text-4xl font-bold tabular-nums">
            {count}
          </span>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => setCount((c) => Math.min(MAX_COURTS, c + 1))}
            disabled={pending || count >= MAX_COURTS}
            aria-label="코트 늘리기"
          >
            <Plus className="size-5" />
          </Button>
        </div>
        <Button
          className="mt-6 w-full"
          onClick={apply}
          disabled={pending || !changed}
        >
          {pending ? "저장 중…" : changed ? "적용" : "변경 없음"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        현재 {courts.length}개 · 코트를 줄이면 뒤 번호부터 사라집니다(게임 중인
        코트는 보호).
      </p>
    </div>
  );
}
