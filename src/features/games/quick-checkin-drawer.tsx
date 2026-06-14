"use client";

import { useState } from "react";
import { QrCode, ChevronUp, X } from "lucide-react";
import { CheckinQrContent } from "@/features/attendance/checkin-qr";

/**
 * 코트/게임 화면에서 출석 탭으로 가지 않고도 QR 셀프 출석을 띄우는 접이식 바텀시트.
 * 하단 토글을 누르면 아래에서 시트가 올라오고 QR이 표시된다.
 */
export function QuickCheckinDrawer({ checkinToken }: { checkinToken: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 하단 중앙 토글 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-x-1/2 hover:scale-105"
        aria-label="QR 셀프 출석 열기"
      >
        <QrCode className="size-4" />
        QR 셀프 출석
        <ChevronUp className="size-4" />
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
      >
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
