"use client";

import { useRef, useState } from "react";
import { QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckinQrContent } from "@/features/attendance/checkin-qr";

const SWIPE = 40; // 스와이프 인식 최소 이동(px)

/**
 * 코트/게임 화면 헤더의 "QR 셀프 출석" 버튼 → 아래에서 올라오는 바텀시트.
 * 트리거는 헤더에 인라인으로, 시트는 fixed로 떠서 코트 카드를 가리지 않는다.
 */
export function QuickCheckinDrawer({ checkinToken }: { checkinToken: string }) {
  const [open, setOpen] = useState(false);
  const sheetStartY = useRef<number | null>(null);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />QR 셀프 출석
      </Button>

      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* 바텀시트 (아래로 쓸면 닫힘) */}
      <aside
        data-no-swipe
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
          if (end - start > SWIPE) setOpen(false);
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
