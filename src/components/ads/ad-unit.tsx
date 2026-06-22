"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

// 환경변수가 있어야 광고가 켜진다. (ca-pub-XXXX) — 미설정이면 아무것도 렌더하지 않음.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 애드센스 광고 단위. 사전 작업 단계에서는 NEXT_PUBLIC_ADSENSE_CLIENT 가 비어 있어
 * 렌더되지 않는다. 값을 채우면 자동으로 표시된다(국내 한정, 동의 배너 불필요).
 */
export function AdUnit({
  slot,
  className,
}: {
  slot?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 이미 채워진 슬롯에 재요청 시 발생할 수 있음 — 무시.
    }
  }, []);

  if (!CLIENT) return null;

  return (
    <ins
      className={cn("adsbygoogle block", className)}
      style={{ display: "block" }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
