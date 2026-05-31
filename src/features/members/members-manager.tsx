"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderToggle, type GenderValue } from "@/components/ui/gender-toggle";
import { GradeToggle, type GradeValue } from "@/components/ui/grade-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GENDER_LABEL,
  SKILL_VALUE,
  GRADE_BY_VALUE,
  type SkillGrade,
} from "@/lib/constants";
import {
  createMember,
  updateMember,
  deleteMember,
} from "@/server/mutations/members";
import type { ClubMember } from "@/types/db";

interface FormState {
  id?: string;
  name: string;
  gender: GenderValue;
  level: GradeValue; // 등급 문자(S~F) 또는 "none"
}

const EMPTY: FormState = { name: "", gender: "none", level: "none" };

export function MembersManager({ members }: { members: ClubMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<ClubMember | null>(null);
  const [pending, startTransition] = useTransition();

  const openCreate = () => {
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (m: ClubMember) => {
    setForm({
      id: m.id,
      name: m.name,
      gender: (m.gender as GenderValue) ?? "none",
      level: m.level ? GRADE_BY_VALUE[m.level] : "none",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("이름을 입력하세요.");
      return;
    }
    const fd = new FormData();
    if (form.id) fd.set("id", form.id);
    fd.set("name", form.name.trim());
    fd.set("gender", form.gender === "none" ? "" : form.gender);
    fd.set(
      "level",
      form.level === "none" ? "" : String(SKILL_VALUE[form.level]),
    );

    startTransition(async () => {
      const res = form.id ? await updateMember(fd) : await createMember(fd);
      if (res.ok) {
        toast.success(form.id ? "수정되었습니다." : "회원이 추가되었습니다.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteMember(deleting.id);
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
      <div className="mb-3 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />회원 추가
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="w-16">성별</TableHead>
              <TableHead className="w-16">등급</TableHead>
              <TableHead className="w-28 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  아직 회원이 없습니다. “회원 추가”로 시작하세요.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.gender ? GENDER_LABEL[m.gender] : "-"}</TableCell>
                <TableCell>{m.level ? GRADE_BY_VALUE[m.level] : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(m)}
                      disabled={pending}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(m)}
                      disabled={pending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "회원 수정" : "회원 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="m-name">이름 *</Label>
              <Input
                id="m-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label>성별</Label>
              <GenderToggle
                value={form.gender}
                onChange={(v) => setForm({ ...form, gender: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>등급</Label>
              <GradeToggle
                value={form.level}
                onChange={(v) => setForm({ ...form, level: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회원 삭제</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” 회원을 삭제할까요? 과거 출석·게임 기록은
              보존됩니다.
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
