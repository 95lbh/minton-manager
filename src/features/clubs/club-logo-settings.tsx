"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2, Loader2, Square, RectangleHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateClubLogo } from "@/server/mutations/clubs";

const LOGO_BUCKET = "club-logos";
const MAX_EDGE = 512; // 저장 시 가장 긴 변(px) 상한
const MAX_FILE = 5 * 1024 * 1024; // 업로드 전 원본 최대 5MB

/** 로고를 화면에 맞추는 방식. contain=원본 비율 유지, square=정사각형 가운데 크롭. */
type Fit = "contain" | "square";

/**
 * 업로드 이미지를 선택한 방식대로 webp Blob 으로 변환.
 * - contain: 원본 비율 그대로, 가장 긴 변을 MAX_EDGE 이하로 축소(확대는 안 함).
 * - square: 정사각형(MAX_EDGE)으로 가운데 크롭.
 */
async function processImage(file: File, fit: Fit): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없습니다.");

  if (fit === "square") {
    canvas.width = MAX_EDGE;
    canvas.height = MAX_EDGE;
    const scale = Math.max(MAX_EDGE / bitmap.width, MAX_EDGE / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (MAX_EDGE - w) / 2, (MAX_EDGE - h) / 2, w, h);
  } else {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했습니다."))),
      "image/webp",
      0.9,
    ),
  );
}

export function ClubLogoSettings({
  clubId,
  clubName,
  logoUrl,
}: {
  clubId: string;
  clubName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<Fit>("contain");
  // 저장 전 후보: 선택한 원본 파일 + 현재 방식으로 만든 미리보기.
  const [picked, setPicked] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  // 미리보기 objectURL 누수 방지.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const buildPreview = async (file: File, nextFit: Fit) => {
    setBusy(true);
    try {
      const blob = await processImage(file, nextFit);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), blob };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지를 처리할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일을 선택하세요.");
      return;
    }
    if (file.size > MAX_FILE) {
      toast.error("5MB 이하 이미지를 선택하세요.");
      return;
    }
    setPicked(file);
    await buildPreview(file, fit);
  };

  const changeFit = async (next: Fit) => {
    if (next === fit) return;
    setFit(next);
    if (picked) await buildPreview(picked, next);
  };

  const clearPreview = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPicked(null);
  };

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${clubId}/logo.webp`;
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, preview.blob, { upsert: true, contentType: "image/webp" });
      if (error) throw new Error("업로드에 실패했습니다. 다시 시도해 주세요.");

      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      // 같은 경로 덮어쓰기라 캐시 무효화를 위해 버전 쿼리를 붙인다.
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const res = await updateClubLogo(clubId, url);
      if (!res.ok) throw new Error(res.error.message);
      toast.success("로고를 저장했습니다.");
      clearPreview();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "로고 업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("로고를 제거할까요?")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.storage.from(LOGO_BUCKET).remove([`${clubId}/logo.webp`]);
      const res = await updateClubLogo(clubId, null);
      if (!res.ok) throw new Error(res.error.message);
      toast.success("로고를 제거했습니다.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "로고 제거에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 미리보기에 보일 이미지 주소(후보가 있으면 후보, 없으면 저장된 로고).
  const shownUrl = preview?.url ?? logoUrl;

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">클럽 로고</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        헤더와 클럽 목록에 표시됩니다. 정사각형·직사각형 모두 지원합니다.
      </p>

      {/* 미리보기 영역 */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* 큰 미리보기 */}
        <div className="flex min-h-28 flex-1 items-center justify-center rounded-lg border bg-muted/40 p-3">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt="클럽 로고 미리보기"
              className="max-h-24 max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImagePlus className="size-6" />
              <span className="text-xs">로고 없음</span>
            </div>
          )}
        </div>

        {/* 헤더에서 어떻게 보이는지 */}
        <div className="relative flex min-h-28 flex-1 items-center justify-center rounded-lg border bg-background px-4 pb-3 pt-7">
          <span className="absolute right-3 top-2 text-[11px] text-muted-foreground">
            헤더에서는 이렇게 보여요
          </span>
          <div className="flex items-center gap-2.5 rounded-md text-2xl font-bold">
            {shownUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownUrl}
                alt=""
                className="h-12 w-auto max-w-[160px] shrink-0 rounded-md object-contain"
              />
            )}
            <span className="truncate">{clubName}</span>
          </div>
        </div>
      </div>

      {/* 후보가 있을 때만: 비율 토글 + 저장/취소 */}
      {preview ? (
        <div className="mt-4 space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              표시 방식
            </span>
            <div className="mt-1.5 inline-flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => changeFit("contain")}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                  fit === "contain"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <RectangleHorizontal className="size-4" /> 원본 비율
              </button>
              <button
                type="button"
                onClick={() => changeFit("square")}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                  fit === "square"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Square className="size-4" /> 정사각형
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {fit === "contain"
                ? "원본 가로세로 비율을 그대로 유지합니다."
                : "가운데를 정사각형으로 잘라 맞춥니다."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 size-4" />
              )}
              저장
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              다른 이미지
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={clearPreview}
              disabled={busy}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus className="mr-1.5 size-4" />
            {logoUrl ? "로고 변경" : "로고 추가"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 size-4" /> 제거
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
    </section>
  );
}
