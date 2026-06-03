"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateClubLogo } from "@/server/mutations/clubs";

const LOGO_BUCKET = "club-logos";
const LOGO_SIZE = 256; // 저장 크기(정사각형, px)
const MAX_FILE = 5 * 1024 * 1024; // 업로드 전 원본 최대 5MB

/** 이미지를 정사각형으로 가운데 크롭해 webp Blob 으로 변환. */
async function resizeToWebp(file: File, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없습니다.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했습니다."))),
      "image/webp",
      0.85,
    ),
  );
}

export function ClubLogoSettings({
  clubId,
  logoUrl,
}: {
  clubId: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
    try {
      const blob = await resizeToWebp(file, LOGO_SIZE);
      const supabase = createClient();
      const path = `${clubId}/logo.webp`;
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (error) throw new Error("업로드에 실패했습니다. 다시 시도해 주세요.");

      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      // 같은 경로에 덮어쓰므로 캐시 무효화를 위해 버전 쿼리를 붙인다.
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const res = await updateClubLogo(clubId, url);
      if (!res.ok) throw new Error(res.error.message);
      toast.success("로고를 저장했습니다.");
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

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">클럽 로고</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        헤더와 클럽 목록에 표시됩니다. 정사각형 이미지를 권장합니다.
      </p>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="클럽 로고"
              className="size-full object-cover"
            />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus className="mr-1.5 h-4 w-4" />
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
              <Trash2 className="mr-1.5 h-4 w-4" /> 제거
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </div>
      </div>
    </section>
  );
}
