"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCourt, updateCourt, deleteCourt } from "@/server/mutations/courts";
import type { Court } from "@/types/db";

export function CourtsManager({ courts }: { courts: Court[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Court | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<Court | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("코트 이름을 입력하세요.");
      return;
    }
    const fd = new FormData();
    fd.set("name", newName.trim());
    startTransition(async () => {
      const res = await createCourt(fd);
      if (res.ok) {
        toast.success("코트가 추가되었습니다.");
        setNewName("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error("코트 이름을 입력하세요.");
      return;
    }
    const fd = new FormData();
    fd.set("id", editing.id);
    fd.set("name", editName.trim());
    startTransition(async () => {
      const res = await updateCourt(fd);
      if (res.ok) {
        toast.success("수정되었습니다.");
        setEditing(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteCourt(deleting.id);
      if (res.ok) {
        toast.success("삭제되었습니다.");
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="코트 이름 (예: 1번 코트)"
          maxLength={30}
        />
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />추가
        </Button>
      </form>

      {courts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          아직 코트가 없습니다. 위에서 코트를 추가하세요.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <li
              key={court.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <span className="font-medium">{court.name}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(court);
                    setEditName(court.name);
                  }}
                  disabled={pending}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(court)}
                  disabled={pending}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>코트 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="c-name">코트 이름</Label>
            <Input
              id="c-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              maxLength={30}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              취소
            </Button>
            <Button onClick={saveEdit} disabled={pending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>코트 삭제</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” 코트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
