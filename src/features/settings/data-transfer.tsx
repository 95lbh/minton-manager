"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Upload, Layers, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportMembers, importMembers } from "@/server/mutations/data-transfer";
import type {
  ImportMode,
  MemberExportRow,
} from "@/server/mutations/data-transfer-format";

export function DataTransferSettings({
  isOwner = true,
}: {
  isOwner?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  // 파일을 읽어 검증한 결과를 담아 두고, 덮어쓰기/병합 선택을 받는다.
  const [staged, setStaged] = useState<{
    members: MemberExportRow[];
    clubName: string;
    fileName: string;
  } | null>(null);

  const doExport = () => {
    startTransition(async () => {
      const res = await exportMembers();
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "내보낼 데이터가 없습니다." : res.error.message);
        return;
      }
      const { bundle, fileName } = res.data;
      try {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`회원 ${bundle.members.length}명을 내보냈습니다.`);
      } catch {
        toast.error("파일을 만드는 데 실패했습니다.");
      }
    });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        type?: string;
        members?: unknown;
        club?: { name?: string };
      };
      if (parsed?.type !== "members" || !Array.isArray(parsed.members)) {
        toast.error("마이민턴 회원 백업 파일이 아닙니다.");
        return;
      }
      const members = parsed.members as MemberExportRow[];
      if (members.length === 0) {
        toast.error("파일에 회원이 없습니다.");
        return;
      }
      setStaged({
        members,
        clubName: parsed.club?.name ?? "",
        fileName: file.name,
      });
    } catch {
      toast.error("파일을 읽을 수 없습니다. JSON 형식을 확인하세요.");
    }
  };

  const runImport = (mode: ImportMode) => {
    if (!staged) return;
    const members = staged.members;
    setStaged(null);
    startTransition(async () => {
      const res = await importMembers(members, mode);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const { imported, skipped, removed } = res.data ?? {
        imported: 0,
        skipped: 0,
        removed: 0,
      };
      const parts = [`회원 ${imported}명을 불러왔습니다`];
      if (mode === "overwrite" && removed) parts.push(`기존 ${removed}명 정리`);
      if (mode === "merge" && skipped) parts.push(`중복 ${skipped}명 제외`);
      toast.success(parts.join(" · ") + ".");
    });
  };

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">회원 백업 / 불러오기</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        회원 목록을 파일로 내보내 보관하거나, 다른 클럽으로 옮길 수 있습니다.
        (출석·게임 기록과 통계는 포함되지 않습니다)
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={doExport}
            disabled={pending}
          >
            <Download className="mr-1.5 h-4 w-4" /> 회원 내보내기
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            현재 클럽 회원을 JSON 파일로 저장합니다.
          </p>
        </div>

        <div className="flex-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <Upload className="mr-1.5 h-4 w-4" /> 회원 불러오기
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            백업 파일을 이 클럽으로 가져옵니다.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </div>

      <Dialog open={!!staged} onOpenChange={(o) => !o && setStaged(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회원 불러오기</DialogTitle>
            <DialogDescription>
              {staged?.clubName ? `‘${staged.clubName}’ 클럽의 ` : ""}
              회원 <b>{staged?.members.length ?? 0}명</b>을 이 클럽으로 불러옵니다.
              <br />
              기존 회원을 어떻게 처리할까요?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              onClick={() => runImport("merge")}
              disabled={pending}
            >
              <Layers className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="font-medium">병합</span>
                <span className="text-xs text-muted-foreground">
                  기존 회원은 그대로 두고 추가합니다. 같은 이름은 건너뜁니다.
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start border-destructive/40 py-3 text-left text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => runImport("overwrite")}
              disabled={pending || !isOwner}
            >
              <Replace className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="font-medium">덮어쓰기</span>
                <span className="text-xs text-muted-foreground/90">
                  기존 회원을 모두 비우고 교체합니다. (과거 기록은 보존)
                  {!isOwner && " — 소유자만 가능"}
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
