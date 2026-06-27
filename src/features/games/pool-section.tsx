"use client";

import { Check, Users } from "lucide-react";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { genderAvatarClass } from "@/components/person-avatar";
import {
  GRADE_BY_VALUE,
  ATTENDEE_STATUSES,
  ATTENDEE_STATUS_LABEL,
  type AttendeeStatus,
} from "@/lib/constants";
import { WaitTime } from "@/features/games/wait-time";
import type { PoolPlayer } from "@/server/queries/games";

const STATUS_BADGE: Record<string, string> = {
  present: "",
  lesson: "bg-blue-100 text-blue-700",
  left: "bg-zinc-200 text-zinc-600",
};

const avatarCls = genderAvatarClass;

/**
 * 좌측 대기자 큐. 코트 패널이 열려 있으면(panelOpen) 대기자를 탭해 선택, 평소엔
 * 대기자 카드를 눌러 상태(대기중/레슨중/집에감)를 바꾼다.
 * 상태·핸들러는 부모(CourtBoard)에서 props로 받는다.
 */
export function PoolSection({
  pool,
  availableCount,
  panelOpen,
  selectedIds,
  lockedIds,
  pending,
  onToggleSelect,
  onSetStatus,
}: {
  pool: PoolPlayer[];
  availableCount: number;
  panelOpen: boolean;
  selectedIds: Set<string>;
  lockedIds: Set<string>;
  pending: boolean;
  onToggleSelect: (recordId: string) => void;
  onSetStatus: (player: PoolPlayer, status: AttendeeStatus) => void;
}) {
  // 성별 분리 + 정렬: 대기중 먼저, 그 안에서 오래 기다린 순(waitingSince 오름차순)
  const { malePool, femalePool, otherPool } = useMemo(() => {
    const byWait = (a: PoolPlayer, b: PoolPlayer) => {
      const ap = a.status === "present" ? 0 : 1;
      const bp = b.status === "present" ? 0 : 1;
      return ap - bp || (a.waitingSince ?? 0) - (b.waitingSince ?? 0);
    };
    return {
      malePool: pool.filter((p) => p.gender === "male").sort(byWait),
      femalePool: pool.filter((p) => p.gender === "female").sort(byWait),
      otherPool: pool
        .filter((p) => p.gender !== "male" && p.gender !== "female")
        .sort(byWait),
    };
  }, [pool]);

  const renderPoolItem = (p: PoolPlayer) => {
    const isPresent = p.status === "present";
    const selectedHere = selectedIds.has(p.id);
    const locked = lockedIds.has(p.id);
    const selectMode = panelOpen && (isPresent || selectedHere) && !locked;

    const statusBadge =
      p.status !== "present" ? (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[p.status] ?? ""}`}
        >
          {ATTENDEE_STATUS_LABEL[p.status as AttendeeStatus] ?? p.status}
        </span>
      ) : null;

    const content = (
      <>
        <div className="flex items-center gap-1.5">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${avatarCls(p.gender)}`}
          >
            {p.skill ? GRADE_BY_VALUE[p.skill] : "·"}
          </div>
          <span className="min-w-0 flex-1 truncate font-semibold leading-tight">
            {p.name}
            {p.isGuest && (
              <span className="ml-0.5 text-xs font-medium text-amber-600">G</span>
            )}
          </span>
          {selectedHere && <Check className="size-4 shrink-0 text-primary" />}
        </div>
        <div className="flex items-center justify-between gap-1 pl-0.5">
          <span className="truncate text-[11px] text-muted-foreground">
            {p.skill ? `${GRADE_BY_VALUE[p.skill]} · ` : ""}
            {p.gamesPlayed}게임
          </span>
          {isPresent ? (
            p.waitingSince ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <WaitTime since={p.waitingSince} />
              </span>
            ) : null
          ) : (
            statusBadge
          )}
        </div>
      </>
    );

    const baseCls = [
      "flex w-full flex-col gap-1 rounded-lg border p-2 text-left text-sm transition-all",
      selectedHere
        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
        : "bg-background hover:bg-muted/60",
      !isPresent && !selectedHere ? "opacity-60" : "",
      locked && panelOpen ? "opacity-40" : "",
    ].join(" ");

    if (panelOpen) {
      return (
        <li key={p.id}>
          <button
            type="button"
            disabled={!selectMode}
            onClick={() => onToggleSelect(p.id)}
            className={`${baseCls} ${selectMode ? "cursor-pointer" : "cursor-default"}`}
          >
            {content}
          </button>
        </li>
      );
    }

    return (
      <li key={p.id}>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            aria-label={`${p.name} 상태 변경`}
            className={`${baseCls} disabled:opacity-50`}
          >
            {content}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ATTENDEE_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onSetStatus(p, s)}>
                {ATTENDEE_STATUS_LABEL[s]}
                {p.status === s && (
                  <Check className="ml-auto size-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  const genderColumn = (label: string, items: PoolPlayer[], dotCls: string) => (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <span className={`size-2 rounded-full ${dotCls}`} />
        <span className="text-xs font-semibold text-muted-foreground">
          {label} {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed py-3 text-center text-[11px] text-muted-foreground">
          없음
        </p>
      ) : (
        <ul className="space-y-2">{items.map(renderPoolItem)}</ul>
      )}
    </div>
  );

  return (
    <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-4">
      <div className="flex flex-col rounded-xl border-2 border-primary/25 bg-card">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight">
              대기자 <span className="text-primary">{availableCount}</span>
              <span className="text-muted-foreground">/{pool.length}</span>
            </h2>
            <Users className="size-4 text-muted-foreground" />
          </div>
          {panelOpen && (
            <p className="mt-1 text-xs font-medium text-primary">
              선택 모드 · 대기자를 눌러 코트에 배정하세요
            </p>
          )}
        </div>

        <div className="p-3">
          {pool.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              출석한 사람이 없습니다.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {genderColumn("남", malePool, "bg-sky-500")}
                {genderColumn("여", femalePool, "bg-rose-500")}
              </div>
              {otherPool.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      성별 미지정 {otherPool.length}
                    </span>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {otherPool.map(renderPoolItem)}
                  </ul>
                </div>
              )}
            </>
          )}
          {!panelOpen && availableCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              대기자를 누르면 상태(대기중/레슨중/집에감)를 바꿀 수 있습니다. 오래
              기다린 순으로 정렬됩니다.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
