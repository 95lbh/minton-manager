"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  SKILL_GRADES,
  SKILL_VALUE,
  GRADE_BY_VALUE,
} from "@/lib/constants";
import {
  createMember,
  updateMember,
  setMemberStatus,
} from "@/server/mutations/members";
import type { ClubMember } from "@/types/db";

const NONE = "none";

interface FormState {
  id?: string;
  name: string;
  gender: string;
  level: string; // SKILL_VALUE 문자열 또는 NONE
  phone: string;
}

const EMPTY: FormState = { name: "", gender: NONE, level: NONE, phone: "" };

export function MembersManager({ members }: { members: ClubMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();

  const openCreate = () => {
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (m: ClubMember) => {
    setForm({
      id: m.id,
      name: m.name,
      gender: m.gender ?? NONE,
      level: m.level ? String(m.level) : NONE,
      phone: m.phone ?? "",
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
    fd.set("gender", form.gender);
    fd.set("level", form.level);
    fd.set("phone", form.phone.trim());

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

  const toggleStatus = (m: ClubMember) => {
    const next = m.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await setMemberStatus(m.id, next);
      if (res.ok) {
        toast.success(next === "active" ? "활성화했습니다." : "비활성화했습니다.");
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
              <TableHead>연락처</TableHead>
              <TableHead className="w-20">상태</TableHead>
              <TableHead className="w-32 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  아직 회원이 없습니다. “회원 추가”로 시작하세요.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id} className={m.status !== "active" ? "opacity-50" : ""}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.gender ? GENDER_LABEL[m.gender] : "-"}</TableCell>
                <TableCell>{m.level ? GRADE_BY_VALUE[m.level] : "-"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.phone ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>
                    {m.status === "active" ? "활성" : "비활성"}
                  </Badge>
                </TableCell>
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
                      onClick={() => toggleStatus(m)}
                      disabled={pending}
                    >
                      {m.status === "active" ? "비활성" : "활성"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>성별</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v ?? NONE })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>미지정</SelectItem>
                    <SelectItem value="male">남</SelectItem>
                    <SelectItem value="female">여</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>등급</Label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v ?? NONE })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>미지정</SelectItem>
                    {SKILL_GRADES.map((g) => (
                      <SelectItem key={g} value={String(SKILL_VALUE[g])}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-phone">연락처</Label>
              <Input
                id="m-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="선택"
                maxLength={20}
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
    </div>
  );
}
