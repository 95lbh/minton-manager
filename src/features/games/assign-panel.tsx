"use client";

import { X, Sparkles, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPOSITIONS,
  COMPOSITION_LABEL,
  type Composition,
} from "@/lib/constants";
import { DEFAULT_GAME_SIZE, type GameSize } from "@/server/services/assignment";
import type { PoolPlayer } from "@/server/queries/games";

const SIZE_LABEL: Record<number, string> = { 4: "복식", 2: "단식" };

/**
 * 코트 배정/수정 패널: 선택된 멤버 표시 + 인원수/구성 선택 + 자동추천 + 시작/수정.
 * 상태·핸들러는 모두 부모(CourtBoard)에서 props로 받는다.
 */
export function AssignPanel({
  isEdit,
  showAuto,
  size,
  comp,
  selectedIds,
  poolById,
  pending,
  onSizeChange,
  onCompChange,
  onAuto,
  onRemove,
  onCancel,
  onSubmit,
}: {
  isEdit: boolean;
  showAuto: boolean;
  size: GameSize;
  comp: Composition;
  selectedIds: string[];
  poolById: Map<string, PoolPlayer>;
  pending: boolean;
  onSizeChange: (s: GameSize) => void;
  onCompChange: (c: Composition) => void;
  onAuto: () => void;
  onRemove: (id: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* === 위: 선택된 멤버 === */}
      <div className="text-xs text-muted-foreground">
        선택 {selectedIds.length}/{size}명 · 왼쪽 대기자에서 탭하여 선택
      </div>

      {selectedIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const p = poolById.get(id);
            if (!p) return null;
            return (
              <li
                key={id}
                className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label={`${p.name} 선택 해제`}
                  className="rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          선택된 멤버가 없습니다
        </div>
      )}

      {/* === 아래: 컨트롤 === */}
      <div className="mt-auto space-y-2 pt-2">
        <div className="flex gap-2">
          <Select
            value={String(size)}
            onValueChange={(v) =>
              onSizeChange((v === "2" ? 2 : DEFAULT_GAME_SIZE) as GameSize)
            }
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue>{SIZE_LABEL[size]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">복식 4명</SelectItem>
              <SelectItem value="2">단식 2명</SelectItem>
            </SelectContent>
          </Select>
          {showAuto && (
            <Select
              value={comp}
              onValueChange={(v) => onCompChange((v ?? "free") as Composition)}
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue>{COMPOSITION_LABEL[comp]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COMPOSITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMPOSITION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {showAuto && (
          <Button variant="secondary" size="sm" className="w-full" onClick={onAuto}>
            <Sparkles className="size-4" />자동 배정 추천
          </Button>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={pending || selectedIds.length !== size}
            onClick={onSubmit}
          >
            {isEdit ? (
              <>
                <Check className="size-4" />수정 완료
              </>
            ) : (
              <>
                <Play className="size-4" />시작
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
