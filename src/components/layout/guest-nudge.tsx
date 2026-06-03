"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { UpgradeButtons } from "@/features/auth/upgrade-buttons";

const DISMISS_KEY = "hm_guest_nudge_dismissed";

/**
 * 비회원 전환 유도 넛지(가벼움).
 * - 대시보드에서만 노출, 한 번 닫으면 localStorage에 기억(다시 안 띄움).
 * - 상단의 상시 배너와 별개로, 로그인 '혜택'을 친화적으로 안내.
 * 비회원일 때만 렌더되도록 AppShell이 감싼다.
 */
export function GuestNudge() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  // localStorage 의 닫힘 여부를 SSR-안전하게 읽는다.
  const dismissed = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => false,
  );

  if (pathname !== ROUTES.dashboard) return null;
  if (hidden || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="relative mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight">
            로그인하면 더 편하게 운영할 수 있어요
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            데이터가 안전하게 보관되고, 다른 기기에서도 이어서 운영하고, 공동
            관리자와 함께 관리할 수 있어요. 지금까지 만든 내용은 그대로 유지됩니다.
          </p>
          <div className="mt-3">
            <UpgradeButtons />
          </div>
        </div>
      </div>
    </div>
  );
}
