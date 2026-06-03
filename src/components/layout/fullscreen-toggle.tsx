"use client";

import { useSyncExternalStore } from "react";
import { Maximize, Minimize } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// 브라우저 전체화면 상태를 fullscreenchange 이벤트와 동기화(SSR-안전).
type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fsElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FsDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function subscribe(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}

/** 전체화면(키오스크) 토글. 현장 디스플레이에 코트 현황을 크게 띄울 때 유용. */
export function FullscreenToggle() {
  const isFs = useSyncExternalStore(
    subscribe,
    () => !!fsElement(),
    () => false,
  );

  const toggle = async () => {
    try {
      if (fsElement()) {
        const d = document as FsDoc;
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } else {
        const el = document.documentElement as FsEl;
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      toast.error("이 브라우저에서는 전체화면을 사용할 수 없습니다.");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-label={isFs ? "전체화면 끄기" : "전체 화면"}
      title={isFs ? "전체화면 끄기 (Esc)" : "전체 화면"}
    >
      {isFs ? (
        <Minimize className="size-4" />
      ) : (
        <Maximize className="size-4" />
      )}
      <span className="hidden sm:inline">
        {isFs ? "전체화면 끄기" : "전체 화면"}
      </span>
    </Button>
  );
}
