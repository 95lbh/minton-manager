"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, RefreshCw, LogIn, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  regenerateJoinCode,
  joinClubByCode,
  deleteClub,
} from "@/server/mutations/clubs";
import { ROUTES } from "@/lib/constants";

export function ClubSettings({
  clubId,
  clubName,
  joinCode,
  isOwner,
}: {
  clubId: string;
  clubName: string;
  joinCode: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState(joinCode);
  const [joinInput, setJoinInput] = useState("");
  const [pending, startTransition] = useTransition();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("코드를 복사했습니다.");
    } catch {
      toast.error("복사에 실패했습니다. 직접 선택해 복사하세요.");
    }
  };

  const regenerate = () => {
    if (
      !confirm(
        "코드를 재생성하면 이전 코드는 더 이상 사용할 수 없습니다. 계속할까요?",
      )
    )
      return;
    startTransition(async () => {
      const res = await regenerateJoinCode(clubId);
      if (res.ok) {
        if (res.data) setCode(res.data.code);
        toast.success("새 코드를 생성했습니다.");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const join = () => {
    if (!joinInput.trim()) {
      toast.error("참여 코드를 입력하세요.");
      return;
    }
    startTransition(async () => {
      const res = await joinClubByCode(joinInput.trim());
      if (res.ok) {
        toast.success("클럽에 참여했습니다.");
        setJoinInput("");
        router.push(ROUTES.dashboard);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const removeClub = () => {
    if (
      !confirm(
        `'${clubName}' 클럽을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteClub(clubId);
      if (res.ok) {
        toast.success("클럽을 삭제했습니다.");
        router.push(ROUTES.dashboard);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 클럽 정보 */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{clubName}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isOwner ? "최고 관리자 (소유자)" : "공동 관리자"}
            </p>
          </div>
        </div>
      </section>

      {/* 공유 코드 */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">공유 코드</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          이 코드를 다른 운영자에게 알려주면, 그 사람이 로그인 후 코드를 입력해
          이 클럽을 함께 관리할 수 있어요. (공동 관리자는 클럽 삭제 불가)
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={code}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={copyCode}
              disabled={pending}
            >
              <Copy className="mr-1 h-4 w-4" /> 복사
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={regenerate}
              disabled={pending}
            >
              <RefreshCw className="mr-1 h-4 w-4" /> 재생성
            </Button>
          </div>
        </div>
      </section>

      {/* 코드로 참여 */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">다른 클럽 참여</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          전달받은 공유 코드를 입력하면 해당 클럽의 공동 관리자가 됩니다.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="join-code" className="sr-only">
            참여 코드
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="join-code"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="참여 코드 붙여넣기"
              className="font-mono text-xs"
            />
            <Button type="button" onClick={join} disabled={pending}>
              <LogIn className="mr-1 h-4 w-4" /> 참여
            </Button>
          </div>
        </div>
      </section>

      {/* 위험 구역: 클럽 삭제 (소유자만) */}
      {isOwner && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold text-destructive">클럽 삭제</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            클럽과 모든 운영 데이터가 더 이상 보이지 않게 됩니다. 소유자만 삭제할
            수 있습니다.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="mt-3"
            onClick={removeClub}
            disabled={pending}
          >
            <Trash2 className="mr-1 h-4 w-4" /> 클럽 삭제
          </Button>
        </section>
      )}
    </div>
  );
}
