"use client";

import { useEffect } from "react";

/**
 * 과거에 등록된 서비스워커를 정리한다(더 이상 SW를 등록하지 않음).
 * 낡은 SW가 내비게이션을 가로채 무한 로딩을 일으킨 사례가 있어, 클라이언트에서도
 * 등록을 해제한다. (public/sw.js 도 자가 제거 kill switch 로 동작)
 * 오프라인 캐시가 다시 필요해지면 견고한 SW로 재도입 가능.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {
        // 조용히 무시
      });
  }, []);

  return null;
}
