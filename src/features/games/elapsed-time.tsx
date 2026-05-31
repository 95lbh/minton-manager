"use client";

import { useEffect, useState } from "react";

/** 시작 시각으로부터 경과시간을 분:초로 1초마다 갱신해 표시. */
export function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startedAt).getTime();
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {mm}:{ss}
    </span>
  );
}
