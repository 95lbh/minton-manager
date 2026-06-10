"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateClubDialog } from "@/features/clubs/create-club-dialog";
import { setActiveClub, renameClub } from "@/server/mutations/clubs";
import { cn } from "@/lib/utils";
import type { MyClub } from "@/server/queries/clubs";

export function ClubSwitcher({
  clubs,
  activeClub,
}: {
  clubs: MyClub[];
  activeClub: MyClub;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(activeClub.name);

  const handleSelect = (clubId: string) => {
    if (clubId === activeClub.id) return;
    startTransition(async () => {
      await setActiveClub(clubId);
      router.refresh();
    });
  };

  const openRename = () => {
    setName(activeClub.name);
    setRenameOpen(true);
  };

  const submitRename = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("클럽 이름을 입력하세요.");
      return;
    }
    if (trimmed === activeClub.name) {
      setRenameOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await renameClub(activeClub.id, trimmed);
      if (res.ok) {
        toast.success("클럽 이름을 변경했습니다.");
        setRenameOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-lg font-bold hover:bg-muted"
        >
          {activeClub.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeClub.logo_url}
              alt=""
              className="h-7 w-auto max-w-[120px] shrink-0 rounded-md object-contain"
            />
          )}
          <span className="truncate">{activeClub.name}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {clubs.map((club) => (
            <DropdownMenuItem
              key={club.id}
              onClick={() => handleSelect(club.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                {club.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={club.logo_url}
                    alt=""
                    className="h-5 w-auto max-w-[72px] shrink-0 rounded object-contain"
                  />
                ) : (
                  <span className="size-5 shrink-0 rounded bg-muted" />
                )}
                <span className="truncate">{club.name}</span>
              </span>
              <Check
                className={cn(
                  "size-4 shrink-0",
                  club.id === activeClub.id ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />새 클럽 만들기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 클럽 이름 옆 작은 수정 버튼 */}
      <button
        type="button"
        onClick={openRename}
        disabled={pending}
        aria-label="클럽 이름 수정"
        title="클럽 이름 수정"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <Pencil className="size-3.5" />
      </button>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클럽 이름 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="club-rename" className="sr-only">
              클럽 이름
            </Label>
            <Input
              id="club-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              취소
            </Button>
            <Button onClick={submitRename} disabled={pending || !name.trim()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
