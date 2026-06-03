"use client";

import { useEffect } from "react";

/**
 * 서비스워커 등록(프로덕션 전용).
 * 개발 중에는 .next/HMR 캐시 혼선을 피하려 등록하지 않는다 → npm run start 에서 동작.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패는 조용히 무시(앱 동작에는 영향 없음)
    });
  }, []);

  return null;
}
