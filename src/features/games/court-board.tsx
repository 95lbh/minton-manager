"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Square, Play, X, Check, Clock, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GENDER_LABEL,
  GRADE_BY_VALUE,
  COMPOSITIONS,
  COMPOSITION_LABEL,
  ATTENDEE_STATUSES,
  ATTENDEE_STATUS_LABEL,
  type Composition,
  type AttendeeStatus,
} from "@/lib/constants";
import { ElapsedTime } from "@/features/games/elapsed-time";
import { recommendGame, type GameSize } from "@/server/services/assignment";
import { startGame, endGame } from "@/server/mutations/games";
import { addCourt, deleteCourt } from "@/server/mutations/courts";
import { setAttendeeStatus } from "@/server/mutations/attendance";
import type { CourtViewData, PoolPlayer } from "@/server/queries/games";

const SIZE_LABEL: Record<number, string> = { 4: "복식", 2: "단식" };

const STATUS_BADGE: Record<string, string> = {
  present: "",
  lesson: "bg-blue-100 text-blue-700",
  left: "bg-zinc-200 text-zinc-600",
};

export function CourtBoard({
  sessionId,
  data,
}: {
  sessionId: string;
  data: CourtViewData;
}) {
  const router = useRouter();
  const { courts, ongoing, pool, currentSeq, history } = data;
  const [pending, startTransition] = useTransition();

  const [gameSize, setGameSize] = useState<Record<string, GameSize>>({});
  const [composition, setComposition] = useState<Record<string, Composition>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [openCourt, setOpenCourt] = useState<string | null>(null);

  const ongoingByCourt = useMemo(() => {
    const m = new Map<string, (typeof ongoing)[number]>();
    for (const o of ongoing) m.set(o.game.court_id, o);
    return m;
  }, [ongoing]);

  const poolById = useMemo(() => {
    const m = new Map<string, PoolPlayer>();
    for (const p of pool) m.set(p.id, p);
    return m;
  }, [pool]);

  // 배정 가능한 사람 = 대기중(present)만
  const availablePool = useMemo(
    () => pool.filter((p) => p.status === "present"),
    [pool],
  );

  const sizeOf = (courtId: string): GameSize => gameSize[courtId] ?? 4;
  const compOf = (courtId: string): Composition => composition[courtId] ?? "free";
  const selOf = (courtId: string): Set<string> => selected[courtId] ?? new Set();

  const toggleSelect = (courtId: string, recordId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[courtId] ?? []);
      if (set.has(recordId)) set.delete(recordId);
      else {
        if (set.size >= sizeOf(courtId)) {
          toast.error(`${sizeOf(courtId)}명까지 선택할 수 있습니다.`);
          return prev;
        }
        set.add(recordId);
      }
      next[courtId] = set;
      return next;
    });
  };

  /** 자동 추천: 대기중인 사람만으로 후보를 뽑는다. */
  const autoFill = (courtId: string) => {
    const rec = recommendGame(availablePool, history, {
      gameSize: sizeOf(courtId),
      composition: compOf(courtId),
      currentSeq,
    });
    if (!rec) {
      toast.error(
        compOf(courtId) === "mixed"
          ? "혼복 인원(남/여)이 부족합니다."
          : "배정할 대기 인원이 부족합니다.",
      );
      return;
    }
    setSelected((prev) => ({ ...prev, [courtId]: new Set(rec.players) }));
    if (rec.warnings.length > 0) toast.warning(rec.warnings[0]);
    else toast.success("자동 배정 추천 완료");
  };

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMsg: string,
    onOk?: () => void,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (successMsg) toast.success(successMsg);
        onOk?.();
        router.refresh();
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  const start = (courtId: string) => {
    const ids = [...selOf(courtId)];
    if (ids.length !== sizeOf(courtId)) {
      toast.error(`${sizeOf(courtId)}명을 채워주세요. (현재 ${ids.length}명)`);
      return;
    }
    run(() => startGame(sessionId, courtId, ids), "게임을 시작했습니다.", () => {
      setSelected((prev) => ({ ...prev, [courtId]: new Set() }));
      setOpenCourt(null);
    });
  };

  const lockedElsewhere = (courtId: string) => {
    const locked = new Set<string>();
    for (const [cid, set] of Object.entries(selected)) {
      if (cid === courtId) continue;
      for (const id of set) locked.add(id);
    }
    return locked;
  };

  return (
    <div className="space-y-8">
      {/* 코트 카드 그리드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((court) => {
          const game = ongoingByCourt.get(court.id);
          const isOpen = openCourt === court.id;
          const sel = selOf(court.id);

          return (
            <div
              key={court.id}
              className="flex flex-col rounded-xl border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{court.name}</h3>
                {game ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    게임 중
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      비어 있음
                    </span>
                    {!isOpen && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => deleteCourt(court.id), "코트를 삭제했습니다.")
                        }
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                        aria-label="코트 삭제"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 게임 중 */}
              {game ? (
                <div className="mt-3 flex flex-1 flex-col">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Clock className="size-3.5" />
                    <ElapsedTime startedAt={game.game.started_at} />
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-1.5">
                    {game.players.map((p) => (
                      <div
                        key={p.attendanceRecordId}
                        className="flex flex-col justify-center rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.gender ? GENDER_LABEL[p.gender] : ""}
                          {p.level ? ` · ${GRADE_BY_VALUE[p.level]}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-3"
                    disabled={pending}
                    onClick={() => run(() => endGame(game.game.id), "게임을 종료했습니다.")}
                  >
                    <Square className="size-4" />게임 종료
                  </Button>
                </div>
              ) : isOpen ? (
                /* 배정 패널 */
                <div className="mt-3 flex flex-1 flex-col gap-3">
                  <div className="flex gap-2">
                    <Select
                      value={String(sizeOf(court.id))}
                      onValueChange={(v) =>
                        setGameSize((p) => ({
                          ...p,
                          [court.id]: (v === "2" ? 2 : 4) as GameSize,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue>{SIZE_LABEL[sizeOf(court.id)]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">복식 4명</SelectItem>
                        <SelectItem value="2">단식 2명</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={compOf(court.id)}
                      onValueChange={(v) =>
                        setComposition((p) => ({
                          ...p,
                          [court.id]: (v ?? "free") as Composition,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue>
                          {COMPOSITION_LABEL[compOf(court.id)]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COMPOSITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {COMPOSITION_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => autoFill(court.id)}
                  >
                    <Sparkles className="size-4" />자동 배정 추천
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    선택 {sel.size}/{sizeOf(court.id)}명 · 아래 대기자에서 탭하여
                    선택
                  </div>

                  {sel.size > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {[...sel].map((id) => {
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
                              onClick={() => toggleSelect(court.id, id)}
                              className="rounded-full p-0.5 hover:bg-muted"
                            >
                              <X className="size-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-auto flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOpenCourt(null);
                        setSelected((p) => ({ ...p, [court.id]: new Set() }));
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={pending || sel.size !== sizeOf(court.id)}
                      onClick={() => start(court.id)}
                    >
                      <Play className="size-4" />시작
                    </Button>
                  </div>
                </div>
              ) : (
                /* 빈 코트 기본 */
                <div className="mt-3 flex flex-1 flex-col justify-center">
                  <Button onClick={() => setOpenCourt(court.id)}>
                    <Play className="size-4" />게임 배정
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* 코트 추가 카드 */}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => addCourt(), "코트를 추가했습니다.")}
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
        >
          <Plus className="size-6" />
          <span className="text-lg font-semibold">코트 추가</span>
        </button>
      </div>

      {/* 대기자 풀 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          대기자 ({availablePool.length}/{pool.length})
        </h2>
        {pool.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            출석한 사람이 없습니다.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {pool.map((p) => {
              const activeCourt = openCourt;
              const isPresent = p.status === "present";
              const selectedHere = activeCourt
                ? selOf(activeCourt).has(p.id)
                : false;
              const lockedSet = activeCourt
                ? lockedElsewhere(activeCourt)
                : new Set<string>();
              const locked = lockedSet.has(p.id);
              // 패널 열림 + 대기중 + 다른 코트에 안 잡힘 → 선택 모드
              const selectMode = !!activeCourt && isPresent && !locked;

              const info = (
                <div className="min-w-0 text-left">
                  <div className="truncate font-medium">
                    {p.name}
                    {p.isGuest && (
                      <span className="ml-1 text-xs text-amber-600">G</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.gender ? GENDER_LABEL[p.gender] : ""}
                    {p.skill ? ` · ${GRADE_BY_VALUE[p.skill]}` : ""}
                    {` · ${p.gamesPlayed}게임`}
                  </div>
                </div>
              );

              const statusBadge =
                p.status !== "present" ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[p.status] ?? ""}`}
                  >
                    {ATTENDEE_STATUS_LABEL[p.status as AttendeeStatus] ?? p.status}
                  </span>
                ) : null;

              const baseCls = [
                "flex w-full items-center justify-between gap-1 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                selectedHere ? "border-primary bg-primary/10" : "bg-card",
                !isPresent ? "opacity-60" : "",
                locked && activeCourt ? "opacity-40" : "",
              ].join(" ");

              // 배정 패널이 열려 있으면: 선택 토글 (대기중만)
              if (activeCourt) {
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!selectMode}
                      onClick={() => toggleSelect(activeCourt, p.id)}
                      className={`${baseCls} ${selectMode ? "hover:bg-muted" : "cursor-default"}`}
                    >
                      {info}
                      {selectedHere ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : (
                        statusBadge
                      )}
                    </button>
                  </li>
                );
              }

              // 패널 없음: 상태 변경 메뉴
              return (
                <li key={p.id}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={pending}
                      className={`${baseCls} hover:bg-muted disabled:opacity-50`}
                    >
                      {info}
                      {statusBadge}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {ATTENDEE_STATUSES.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() =>
                            run(
                              () => setAttendeeStatus(p.id, s),
                              `${p.name} · ${ATTENDEE_STATUS_LABEL[s]}`,
                            )
                          }
                        >
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
            })}
          </ul>
        )}
        {!openCourt && availablePool.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            대기자를 누르면 상태(대기중/레슨중/집에감)를 바꿀 수 있습니다.
          </p>
        )}
      </section>
    </div>
  );
}
