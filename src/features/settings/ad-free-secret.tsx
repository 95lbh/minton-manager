"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAdFree } from "@/server/mutations/prefs";

const NEED = 7; // 비밀 토글 활성화에 필요한 연속 탭 수

/**
 * 설정 하단의 눈에 띄지 않는 버전 문구. 7번 연속 누르면 이 계정의 광고를 켜고 끈다.
 * (안드로이드 개발자 옵션처럼 숨겨진 토글)
 */
export function AdFreeSecret({ adFree }: { adFree: boolean }) {
  const router = useRouter();
  const [taps, setTaps] = useState(0);
  const [pending, startTransition] = useTransition();

  const onTap = () => {
    if (pending) return;
    const n = taps + 1;
    if (n >= NEED) {
      setTaps(0);
      startTransition(async () => {
        const res = await setAdFree(!adFree);
        if (res.ok) {
          toast.success(
            !adFree ? "광고를 제거했습니다." : "광고를 다시 표시합니다.",
          );
          router.refresh();
        } else {
          toast.error(res.error.message);
        }
      });
    } else {
      setTaps(n);
      if (n >= NEED - 3) toast(`${NEED - n}번 더…`);
    }
  };

  return (
    <p
      onClick={onTap}
      className="cursor-default select-none pt-2 text-center text-[11px] text-muted-foreground/50"
    >
      마이민턴 · v1.0{adFree ? " · 광고 없음" : ""}
    </p>
  );
}
