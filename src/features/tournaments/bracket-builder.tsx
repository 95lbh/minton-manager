"use client";

import { useMemo, useState } from "react";
import { RotateCcw, GitFork, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MemberGender, TournamentParticipant } from "@/types/db";

function dot(g: MemberGender | null) {
  return g === "male"
    ? "bg-sky-500"
    : g === "female"
      ? "bg-rose-500"
      : "bg-muted-foreground/40";
}

/**
 * 직접 대진 짜기: 왼쪽 참가자 풀에서 카드를 누르면 순서대로 대진 슬롯에 들어간다.
 * 슬롯1 vs 슬롯2, 슬롯3 vs 슬롯4 … (복식은 2명씩 한 팀). 배치 순서가 곧 대진.
 */
export function BracketBuilder({
  participants,
  isDoubles,
  pending,
  onCancel,
  onGenerate,
}: {
  participants: TournamentParticipant[];
  isDoubles: boolean;
  pending: boolean;
  onCancel: () => void;
  onGenerate: (orderedIds: string[]) => void;
}) {
  const [placed, setPlaced] = useState<string[]>([]);
  const byId = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const placedSet = useMemo(() => new Set(placed), [placed]);
  const pool = participants.filter((p) => !placedSet.has(p.id));

  const perTeam = isDoubles ? 2 : 1;
  const perMatch = perTeam * 2;

  const add = (id: string) => setPlaced((p) => [...p, id]);
  const remove = (id: string) => setPlaced((p) => p.filter((x) => x !== id));

  const filledMatches = Math.ceil(placed.length / perMatch);
  const matchCount = Math.max(1, filledMatches + (pool.length > 0 ? 1 : 0));
  const units = Math.floor(placed.length / perTeam);
  const canGenerate = units >= 2;

  const renderSide = (slots: number[]) => (
    <div className="flex flex-1 flex-col gap-0.5">
      {slots.map((s) => {
        const id = placed[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => id && remove(id)}
            disabled={pending || !id}
            className={`flex items-center justify-between gap-1 rounded px-2 py-1 text-left text-sm ${
              id ? "bg-muted hover:bg-muted/70" : "border border-dashed text-muted-foreground"
            }`}
          >
            <span className="min-w-0 truncate">
              {id ? byId.get(id)?.name : "비어 있음"}
            </span>
            {id && <X className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mt-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">직접 대진 짜기</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            왼쪽 참가자를 누르면 순서대로 대진에 들어갑니다.
            {isDoubles ? " 복식은 2명씩 한 팀이 됩니다." : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlaced([])}
            disabled={pending || placed.length === 0}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> 초기화
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            취소
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {/* 참가자 풀 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            참가자 ({pool.length})
          </p>
          {pool.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              모두 배치했습니다.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {pool.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p.id)}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className={`size-2 rounded-full ${dot(p.gender)}`} />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 대진 미리보기 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">대진</p>
          <ol className="space-y-2">
            {Array.from({ length: matchCount }, (_, mi) => {
              const base = mi * perMatch;
              const blueSlots = Array.from({ length: perTeam }, (_, i) => base + i);
              const whiteSlots = Array.from({ length: perTeam }, (_, i) => base + perTeam + i);
              return (
                <li key={mi} className="flex items-center gap-2 rounded-lg border p-2">
                  <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
                    {mi + 1}
                  </span>
                  {renderSide(blueSlots)}
                  <span className="shrink-0 text-xs text-muted-foreground">vs</span>
                  {renderSide(whiteSlots)}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <Button
        className="mt-3 w-full"
        onClick={() => onGenerate(placed)}
        disabled={pending || !canGenerate}
      >
        <GitFork className="mr-1 h-4 w-4" /> 이 대진으로 생성 ({units}
        {isDoubles ? "팀" : "명"})
      </Button>
    </div>
  );
}
