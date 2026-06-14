"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ROUTES } from "@/components/layout/app-nav";

const THRESHOLD = 70; // 수평 이동 최소(px)
const DOMINANCE = 1.5; // 수평이 수직보다 이 배수 이상일 때만 (세로 흔들림 무시)

/** 가로 스크롤/드래그/다이얼로그 등 스와이프하면 안 되는 영역에서 시작했는지. */
function isBlocked(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      if (node.dataset.noSwipe !== undefined) return true;
      if (node.getAttribute("data-slot") === "dialog-content") return true;
      const ox = getComputedStyle(node).overflowX;
      if (
        (ox === "auto" || ox === "scroll") &&
        node.scrollWidth > node.clientWidth + 2
      ) {
        return true; // 가로 스크롤 가능한 요소(표 등)
      }
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * 모바일 전체 영역 가로 스와이프로 탭 이동.
 * - 왼쪽으로 쓸기 → 다음 탭, 오른쪽으로 쓸기 → 이전 탭
 * - 수평이 수직보다 확실히 클 때만 인식(세로 스와이프는 무시)
 * - 표·드래그 배정·다이얼로그 등에서 시작한 제스처는 무시
 */
export function SwipeNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let sx = 0;
    let sy = 0;
    let blocked = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) {
        blocked = true;
        return;
      }
      sx = t.clientX;
      sy = t.clientY;
      blocked = isBlocked(e.target);
    };

    const onEnd = (e: TouchEvent) => {
      if (blocked) return;
      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      // 수평 우세 + 최소 이동량 (세로로 흔들리면 무시)
      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * DOMINANCE)
        return;

      const idx = NAV_ROUTES.findIndex((r) => pathname.startsWith(r));
      if (idx === -1) return;

      if (dx < 0 && idx < NAV_ROUTES.length - 1) {
        router.push(NAV_ROUTES[idx + 1]); // 왼쪽으로 → 다음 탭
      } else if (dx > 0 && idx > 0) {
        router.push(NAV_ROUTES[idx - 1]); // 오른쪽으로 → 이전 탭
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
