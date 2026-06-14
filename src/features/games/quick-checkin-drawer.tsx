"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, X } from "lucide-react";
import { CheckinQrContent } from "@/features/attendance/checkin-qr";

const SWIPE = 40; // 스와이프 인식 최소 이동(px)

/**
 * 코트/게임 화면에서 출석 탭으로 가지 않고도 QR 셀프 출석을 띄우는 접이식 바텀시트.
 * 하단 토글을 누르거나 화면 하단에서 위로 쓸어 올리면 열린다(모바일).
 */
export function QuickCheckinDrawer({ checkinToken }: { checkinToken: string }) {
  const [open, setOpen] = useState(false);
  const sheetStartY = useRef<number | null>(null);

  // 화면 하단에서 위로 스와이프 → 열기.
  useEffect(() => {
    let startY: number | null = null;
    let fromBottom = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startY = t.clientY;
      fromBottom = t.clientY > window.innerHeight - 120;
    };
    const onEnd = (e: TouchEvent) => {
      if (startY == null) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      if (!open && fromBottom && startY - endY > SWIPE) setOpen(true);
      startY = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  return (
    <>
      {/* 하단 중앙 토글 — 바텀시트의 윗부분(손잡이)이 살짝 올라온 형태 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group fixed bottom-0 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 rounded-t-2xl border border-b-0 bg-card px-7 pb-2.5 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-all hover:pb-3.5 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-label="QR 셀프 출석 열기 (위로 쓸어올리기)"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-primary/40" />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <QrCode className="size-4" />
          QR 셀프 출석
        </span>
      </button>

      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* 바텀시트 */}
      <aside
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border bg-background shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!open}
        onTouchStart={(e) => {
          sheetStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const start = sheetStartY.current;
          if (start == null) return;
          const end = e.changedTouches[0]?.clientY ?? start;
          if (end - start > SWIPE) setOpen(false); // 아래로 쓸면 닫기
          sheetStartY.current = null;
        }}
      >
        {/* 손잡이 */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-bold">QR 셀프 출석</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            회원이 이 QR을 스캔해 본인 이름을 누르면 출석됩니다.
          </p>
          <CheckinQrContent token={checkinToken} />
        </div>
      </aside>
    </>
  );
}
