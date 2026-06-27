"use client";

import { Sparkles, Square, Play, Clock, Trash2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ElapsedTime } from "@/features/games/elapsed-time";
import { AssignPanel } from "@/features/games/assign-panel";
import { genderAvatarClass } from "@/components/person-avatar";
import { GENDER_LABEL, GRADE_BY_VALUE, type Composition } from "@/lib/constants";
import { type GameSize } from "@/server/services/assignment";
import type { Court } from "@/types/db";
import type { OngoingGameView, PoolPlayer } from "@/server/queries/games";

const avatarCls = genderAvatarClass;

/**
 * 코트 1개 카드. 상태(이름편집·열림·게임)는 props로 받고, 모든 액션은 부모 콜백으로 위임한다.
 * 본문은 3가지 중 하나: 배정/수정 패널(AssignPanel) · 진행 중 게임 · 빈 코트.
 */
export function CourtCard({
  court,
  game,
  isOpen,
  openMode,
  renamingValue,
  size,
  comp,
  selectedIds,
  poolById,
  pending,
  onRenameStart,
  onRenameChange,
  onRenameCancel,
  onRenameSubmit,
  onDelete,
  onEdit,
  onOpenAssign,
  onEndGame,
  onCancelGame,
  onSizeChange,
  onCompChange,
  onAuto,
  onRemoveSelected,
  onClosePanel,
  onSubmit,
}: {
  court: Court;
  game: OngoingGameView | undefined;
  isOpen: boolean;
  openMode: "manual" | "auto" | "edit";
  renamingValue: string | undefined;
  size: GameSize;
  comp: Composition;
  selectedIds: string[];
  poolById: Map<string, PoolPlayer>;
  pending: boolean;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCancel: () => void;
  onRenameSubmit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenAssign: (mode: "manual" | "auto") => void;
  onEndGame: () => void;
  onCancelGame: () => void;
  onSizeChange: (s: GameSize) => void;
  onCompChange: (c: Composition) => void;
  onAuto: () => void;
  onRemoveSelected: (id: string) => void;
  onClosePanel: () => void;
  onSubmit: () => void;
}) {
  const isRenaming = renamingValue !== undefined;

  return (
    <div
      className={[
        "flex flex-col overflow-hidden rounded-xl bg-card transition-all",
        isOpen
          ? "border border-primary shadow-sm ring-1 ring-primary/30"
          : game
            ? "border shadow-sm"
            : "border-2 border-dashed",
      ].join(" ")}
    >
      {/* 헤더: 이름(+편집) / 상태배지 / 액션 */}
      <div
        className={`flex items-center justify-between gap-2 px-4 py-3 ${game || isOpen ? "border-b" : ""} ${game ? "bg-muted/30" : ""}`}
      >
        {isRenaming ? (
          <form
            className="flex flex-1 gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              onRenameSubmit();
            }}
          >
            <Input
              value={renamingValue}
              onChange={(e) => onRenameChange(e.target.value)}
              className="h-8"
              autoFocus
              maxLength={30}
            />
            <Button type="submit" size="sm" disabled={pending}>
              저장
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRenameCancel}>
              취소
            </Button>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 truncate font-bold tracking-tight">
              {court.name}
            </h3>
            <div className="flex items-center gap-1">
              {game ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                  진행중
                </span>
              ) : !isOpen ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  비어 있음
                </span>
              ) : null}
              {!isOpen && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onRenameStart}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    aria-label="코트 수정"
                  >
                    <Pencil className="size-4" />
                  </button>
                  {!game && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onDelete}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                      aria-label="코트 삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col p-4">
        {isOpen ? (
          <AssignPanel
            isEdit={openMode === "edit"}
            showAuto={openMode !== "manual"}
            size={size}
            comp={comp}
            selectedIds={selectedIds}
            poolById={poolById}
            pending={pending}
            onSizeChange={onSizeChange}
            onCompChange={onCompChange}
            onAuto={onAuto}
            onRemove={onRemoveSelected}
            onCancel={onClosePanel}
            onSubmit={onSubmit}
          />
        ) : game ? (
          /* 게임 중 */
          <div className="flex flex-1 flex-col">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="size-3.5" />
              <ElapsedTime startedAt={game.game.started_at} />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              {game.players.map((p) => (
                <div
                  key={p.attendanceRecordId}
                  className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2"
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${avatarCls(p.gender)}`}
                  >
                    {p.level ? GRADE_BY_VALUE[p.level] : "·"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {p.gender ? GENDER_LABEL[p.gender] : ""}
                      {p.level ? ` · ${GRADE_BY_VALUE[p.level]}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={onEdit}
              >
                <Pencil className="size-4" />멤버 수정
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={onEndGame}
              >
                <Square className="size-4" />종료
              </Button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={onCancelGame}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />게임 취소 (대기로 되돌리기)
            </button>
          </div>
        ) : (
          /* 빈 코트 기본: 직접 배정 | 자동 배정 */
          <div className="flex flex-1 flex-col justify-center gap-3 py-6">
            <p className="text-center text-sm text-muted-foreground">배정 대기 중</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onOpenAssign("manual")}>
                <Play className="size-4" />직접 배정
              </Button>
              <Button variant="outline" onClick={() => onOpenAssign("auto")}>
                <Sparkles className="size-4" />자동 배정
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
