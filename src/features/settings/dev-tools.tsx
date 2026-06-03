"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { FlaskConical, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { seedRandomMembers } from "@/server/mutations/admin";

const DEV_KEY = "hm_dev_mode";
const TAPS_TO_UNLOCK = 7;

// 개발자 모드 활성 여부를 localStorage 와 동기화하는 외부 스토어.
// (effect 내 setState 없이 useSyncExternalStore 로 SSR-안전하게 읽는다)
let listeners: Array<() => void> = [];
const devStore = {
  subscribe(cb: () => void) {
    listeners.push(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
      window.removeEventListener("storage", cb);
    };
  },
  get() {
    return typeof window !== "undefined" && localStorage.getItem(DEV_KEY) === "1";
  },
  set(v: boolean) {
    if (v) localStorage.setItem(DEV_KEY, "1");
    else localStorage.removeItem(DEV_KEY);
    listeners.forEach((l) => l());
  },
};

/**
 * 개발자 모드. 하단의 눈에 띄지 않는 영역을 연속 7회 탭하면 활성화된다.
 * 활성 상태는 localStorage 에 저장된다(기기별). 현재 기능: 무작위 회원 N명 생성.
 */
export function DevTools() {
  const enabled = useSyncExternalStore(
    devStore.subscribe,
    devStore.get,
    () => false,
  );
  const [count, setCount] = useState("10");
  const [pending, startTransition] = useTransition();

  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSecretTap = () => {
    if (enabled) return; // 이미 켜졌으면 무시
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      taps.current = 0;
    }, 1500);
    if (taps.current >= TAPS_TO_UNLOCK) {
      taps.current = 0;
      devStore.set(true);
      toast.success("개발자 모드가 활성화되었습니다.");
    }
  };

  const disable = () => {
    devStore.set(false);
    toast.message("개발자 모드를 껐습니다.");
  };

  const seed = () => {
    const n = Number(count);
    startTransition(async () => {
      const res = await seedRandomMembers(n);
      if (res.ok) {
        toast.success(`무작위 회원 ${res.data?.created ?? n}명을 생성했습니다.`);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  if (!enabled) {
    // 시크릿 트리거: 흐릿한 푸터. 연속 7회 탭 시 개발자 모드 활성화.
    return (
      <button
        type="button"
        onClick={onSecretTap}
        aria-hidden="true"
        tabIndex={-1}
        className="mx-auto mt-8 block select-none text-center text-[10px] text-muted-foreground/30"
      >
        honey_minton
      </button>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-amber-300/50 bg-amber-50/50 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
          <FlaskConical className="h-4 w-4" /> 개발자 모드
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={disable}
        >
          <X className="mr-1 h-4 w-4" /> 끄기
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        테스트용 도구입니다. 실제 운영 데이터에 영향을 줍니다.
      </p>

      <div className="mt-4">
        <p className="text-sm font-medium">무작위 회원 생성</p>
        <div className="mt-2 flex gap-2">
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-28"
            aria-label="생성할 인원 수"
          />
          <Button type="button" onClick={seed} disabled={pending}>
            <Sparkles className="mr-1 h-4 w-4" /> 생성
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          이름·성별·급수가 무작위인 회원을 1~100명 추가합니다.
        </p>
      </div>
    </section>
  );
}
