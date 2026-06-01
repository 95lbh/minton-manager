"use client";

import { useEffect, useState } from "react";

/** 대기 시작(ms)으로부터 경과 "분"을 표시. 30초마다 갱신. */
export function WaitTime({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const min = Math.max(0, Math.floor((now - since) / 60_000));

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {min}분 대기
    </span>
  );
}
