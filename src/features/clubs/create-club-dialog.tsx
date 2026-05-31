"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClub } from "@/server/mutations/clubs";
import { ROUTES } from "@/lib/constants";

/** 새 클럽 생성 다이얼로그. 생성 후 해당 클럽으로 전환하고 대시보드로 이동. */
export function CreateClubDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("클럽 이름을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", trimmed);
      const res = await createClub(fd);
      if (res.ok) {
        toast.success("새 클럽을 만들었습니다.");
        setName("");
        onOpenChange(false);
        router.push(ROUTES.dashboard);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 클럽 만들기</DialogTitle>
          <DialogDescription>
            새 클럽을 만들고 바로 그 클럽으로 전환합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-club-name">클럽 이름</Label>
            <Input
              id="new-club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="클럽 이름"
              autoFocus
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              취소
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
