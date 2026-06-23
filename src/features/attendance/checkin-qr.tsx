"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { QrCode, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// qrcode.react는 다이얼로그/바텀시트를 열 때만 필요 → 동적 import로 초기 번들에서 분리.
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false },
);

/** QR 셀프 출석 본문(QR + 링크 복사/열기). 다이얼로그·드로어에서 공용. */
export function CheckinQrContent({ token }: { token: string }) {
  // origin은 클라이언트에서만 알 수 있어 렌더 시 계산.
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkin/${token}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요.");
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4">
      <div className="rounded-2xl border bg-white p-4">
        {url && <QRCodeSVG value={url} size={220} marginSize={1} level="M" />}
      </div>
      <p className="w-full min-w-0 truncate rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
        {url}
      </p>
      <div className="flex w-full min-w-0 gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={copy}
        >
          <Copy className="mr-1 size-4" /> 링크 복사
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="mr-1 size-4" /> 열기
        </Button>
      </div>
    </div>
  );
}

/**
 * 관리자용 버튼: 현재 세션의 셀프 체크인 QR 다이얼로그를 띄운다(출석 탭).
 */
export function CheckinQr({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />QR 출석
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR 셀프 출석</DialogTitle>
            <DialogDescription>
              회원이 이 QR을 스캔해 본인 이름을 누르면 출석 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <CheckinQrContent token={token} />
        </DialogContent>
      </Dialog>
    </>
  );
}
