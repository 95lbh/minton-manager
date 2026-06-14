"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ROUTES } from "@/components/layout/app-nav";

const EDGE = 30; // 화면 가장자리 인식 폭(px) — 여기서 시작한 스와이프만 탭 이동
const THRESHOLD = 60; // 수평 이동 최소(px)
const MAX_VERTICAL = 45; // 세로 흔들림 허용치(이보다 크면 무시)

/**
 * 모바일 엣지 스와이프로 탭 이동.
 * - 왼쪽 가장자리에서 오른쪽으로 쓸기 → 이전 탭
 * - 오른쪽 가장자리에서 왼쪽으로 쓸기 → 다음 탭
 * 가장자리에서 시작한 제스처만 인식하므로 표 스크롤·드래그 배정과 충돌하지 않는다.
 * (설치형 PWA에서 가장 자연스럽게 동작. 일부 모바일 브라우저의 좌측 뒤로가기 제스처와 겹칠 수 있음)
 */
export function EdgeSwipeNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let sx = 0;
    let sy = 0;
    let edge: "left" | "right" | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) {
        edge = null;
        return;
      }
      sx = t.clientX;
      sy = t.clientY;
      if (t.clientX <= EDGE) edge = "left";
      else if (t.clientX >= window.innerWidth - EDGE) edge = "right";
      else edge = null;
    };

    const onEnd = (e: TouchEvent) => {
      if (!edge) return;
      const t = e.changedTouches[0];
      const current = edge;
      edge = null;
      if (!t) return;

      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dy) > MAX_VERTICAL) return; // 세로 스와이프는 무시

      const idx = NAV_ROUTES.findIndex((r) => pathname.startsWith(r));
      if (idx === -1) return;

      if (current === "left" && dx > THRESHOLD && idx > 0) {
        router.push(NAV_ROUTES[idx - 1]); // 이전 탭
      } else if (
        current === "right" &&
        dx < -THRESHOLD &&
        idx < NAV_ROUTES.length - 1
      ) {
        router.push(NAV_ROUTES[idx + 1]); // 다음 탭
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return null;
}
