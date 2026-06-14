"use client";

import { useRef, useState } from "react";
import { QrCode, X, ChevronsUp } from "lucide-react";
import { CheckinQrContent } from "@/features/attendance/checkin-qr";

const SWIPE = 40; // 스와이프 인식 최소 이동(px)

/**
 * 코트/게임 화면에서 출석 탭으로 가지 않고도 QR 셀프 출석을 띄우는 접이식 바텀시트.
 * 하단 토글 탭을 누르거나, 그 탭에서 위로 쓸어 올리면 열린다(모바일).
 */
export function QuickCheckinDrawer({ checkinToken }: { checkinToken: string }) {
  const [open, setOpen] = useState(false);
  const sheetStartY = useRef<number | null>(null);
  const toggleStartY = useRef<number | null>(null);

  return (
    <>
      {/* 하단 중앙 토글 — 셰브론 + 라벨의 떠 있는 둥근 버튼. 탭에서 위로 쓸어도 열림. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        onTouchStart={(e) => {
          toggleStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const s = toggleStartY.current;
          if (s == null) return;
          const end = e.changedTouches[0]?.clientY ?? s;
          if (s - end > SWIPE) setOpen(true); // 위로 쓸면 열기
          toggleStartY.current = null;
        }}
        className={`group fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-full bg-primary px-5 py-2 text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-label="QR 셀프 출석 열기 (위로 쓸어올리기)"
      >
        <ChevronsUp className="size-4 motion-safe:animate-bounce" />
        <span className="flex items-center gap-1.5 text-sm font-semibold">
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
