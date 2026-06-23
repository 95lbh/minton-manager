"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  SKILL_GRADES,
} from "@/lib/constants";
import { PersonAvatar } from "@/components/person-avatar";
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
  birthYear: string; // 출생년도(4자리) 또는 ""
}

const EMPTY: FormState = { name: "", gender: "none", level: "none", birthYear: "" };

export function MembersManager({ members }: { members: ClubMember[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<ClubMember | null>(null);
  const [pending, startTransition] = useTransition();

  // 검색·필터·정렬·페이지
  const [query, setQuery] = useState("");
  const [gFilter, setGFilter] = useState<string>("all"); // all|male|female|other|none
  const [lFilter, setLFilter] = useState<string>("all"); // all|S..F|none
  const [sort, setSort] = useState<string>("name"); // name|level|birth
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (gFilter !== "all") {
        if (gFilter === "none" ? m.gender != null : m.gender !== gFilter)
          return false;
      }
      if (lFilter !== "all") {
        const grade = m.level ? GRADE_BY_VALUE[m.level] : "none";
        if (lFilter === "none" ? m.level != null : grade !== lFilter)
          return false;
      }
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      if (sort === "level") return (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name);
      if (sort === "birth") return (b.birth_year ?? 0) - (a.birth_year ?? 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [members, query, gFilter, lFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  // 필터가 바뀌어 페이지 범위를 벗어나면 0으로(렌더 중 setState 대신 파생값 사용).
  const resetPage = () => setPage(0);

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
      birthYear: m.birth_year ? String(m.birth_year) : "",
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
    fd.set("birthYear", form.birthYear.trim());

    startTransition(async () => {
      const res = form.id ? await updateMember(fd) : await createMember(fd);
      if (res.ok) {
        toast.success(form.id ? "수정되었습니다." : "회원이 추가되었습니다.");
        setOpen(false);
        // revalidatePath로 목록 자동 갱신 → router.refresh() 불필요.
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
        // revalidatePath로 목록 자동 갱신 → router.refresh() 불필요.
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="이름 검색"
            aria-label="회원 이름 검색"
            className="pl-9"
          />
        </div>
        <Select
          value={gFilter}
          onValueChange={(v) => {
            setGFilter(v ?? "all");
            resetPage();
          }}
        >
          <SelectTrigger className="w-24" aria-label="성별 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">성별 전체</SelectItem>
            <SelectItem value="male">남</SelectItem>
            <SelectItem value="female">여</SelectItem>
            <SelectItem value="other">기타</SelectItem>
            <SelectItem value="none">미지정</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={lFilter}
          onValueChange={(v) => {
            setLFilter(v ?? "all");
            resetPage();
          }}
        >
          <SelectTrigger className="w-24" aria-label="등급 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">등급 전체</SelectItem>
            {SKILL_GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
            <SelectItem value="none">미지정</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v ?? "name")}>
          <SelectTrigger className="w-28" aria-label="정렬">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">이름순</SelectItem>
            <SelectItem value="level">급수순</SelectItem>
            <SelectItem value="birth">출생년도순</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="size-4" />회원 추가
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="w-16">성별</TableHead>
              <TableHead className="w-16">등급</TableHead>
              <TableHead className="w-20">출생년도</TableHead>
              <TableHead className="w-28 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    아직 회원이 없습니다.
                  </p>
                  <Button className="mt-3" onClick={openCreate}>
                    <Plus className="size-4" />첫 회원 추가
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {members.length > 0 && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <PersonAvatar
                      gender={m.gender}
                      label={m.level ? GRADE_BY_VALUE[m.level] : null}
                      className="size-8"
                    />
                    <span className="font-medium">{m.name}</span>
                  </div>
                </TableCell>
                <TableCell>{m.gender ? GENDER_LABEL[m.gender] : "-"}</TableCell>
                <TableCell>{m.level ? GRADE_BY_VALUE[m.level] : "-"}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {m.birth_year ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${m.name} 수정`}
                      onClick={() => openEdit(m)}
                      disabled={pending}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${m.name} 삭제`}
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

      {/* 페이지네이션 */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="이전 페이지"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {safePage + 1} / {pageCount}
            <span className="ml-2">({filtered.length}명)</span>
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="다음 페이지"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

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
            <div className="space-y-2">
              <Label htmlFor="m-birth">출생년도</Label>
              <Input
                id="m-birth"
                type="number"
                inputMode="numeric"
                placeholder="예: 1998"
                value={form.birthYear}
                onChange={(e) =>
                  setForm({ ...form, birthYear: e.target.value.slice(0, 4) })
                }
                min={1900}
                max={2100}
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
