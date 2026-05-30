"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTodaySession } from "@/server/mutations/attendance";

export function StartSessionButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(async () => {
      const res = await startTodaySession();
      if (res.ok) {
        toast.success("오늘의 출석 세션을 시작했습니다.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <Button size="lg" onClick={handleStart} disabled={pending}>
      <CalendarPlus className="size-4" />
      {pending ? "시작 중…" : "오늘 출석 시작"}
    </Button>
  );
}
