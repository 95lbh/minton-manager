"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
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

export function QrDialog({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    const link = `${window.location.origin}/checkin/${token}`;
    setUrl(link);
    QRCode.toDataURL(link, { width: 320, margin: 2 })
      .then(setDataUrl)
      .catch(() => toast.error("QR 생성에 실패했습니다."));
  }, [open, token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("출석 링크를 복사했습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />QR 출석
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR 출석</DialogTitle>
            <DialogDescription>
              회원이 이 QR을 스캔하면 직접 출석할 수 있습니다. (오늘 세션 전용)
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt="출석 QR 코드"
                className="size-64 rounded-lg border"
              />
            ) : (
              <div className="flex size-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                생성 중…
              </div>
            )}

            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={copy}>
                <Copy className="size-4" />링크 복사
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(url, "_blank")}
              >
                <ExternalLink className="size-4" />미리보기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
