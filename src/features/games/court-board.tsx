"use client";

import { useMemo, useOptimistic, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Square,
  Play,
  Check,
  Clock,
  Trash2,
  Plus,
  Pencil,
  Users,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GENDER_LABEL,
  GRADE_BY_VALUE,
  DEFAULT_COMPOSITION,
  ATTENDEE_STATUSES,
  ATTENDEE_STATUS_LABEL,
  type Composition,
  type AttendeeStatus,
} from "@/lib/constants";
import { ElapsedTime } from "@/features/games/elapsed-time";
import { WaitTime } from "@/features/games/wait-time";
import { genderAvatarClass } from "@/components/person-avatar";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import {
  recommendGame,
  DEFAULT_GAME_SIZE,
  type GameSize,
} from "@/server/services/assignment";
import {
  startGame,
  endGame,
  replaceGamePlayers,
  cancelGame,
} from "@/server/mutations/games";
import { addCourt, deleteCourt, renameCourt } from "@/server/mutations/courts";
import { setAttendeeStatus } from "@/server/mutations/attendance";
import type { CourtViewData, PoolPlayer } from "@/server/queries/games";
import {
  optimisticReducer,
  type OptAction,
} from "@/features/games/court-board-reducer";
import { AssignPanel } from "@/features/games/assign-panel";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/server/types";

// 코트 화면에 영향을 주는 테이블(실시간 구독 대상).
const REALTIME_TABLES = [
  "games",
  "game_players",
  "attendance_records",
  "courts",
] as const;

const STATUS_BADGE: Record<string, string> = {
  present: "",
  lesson: "bg-blue-100 text-blue-700",
  left: "bg-zinc-200 text-zinc-600",
};

const avatarCls = genderAvatarClass;

export function CourtBoard({
  clubId,
  sessionId,
  data,
}: {
  clubId: string;
  sessionId: string;
  data: CourtViewData;
}) {
  const [optData, applyOptimistic] = useOptimistic(data, optimisticReducer);
  const { courts, ongoing, pool, currentSeq, history } = optData;
  const { pending, run: runAction } = useServerAction();

  // 다른 스태프의 코트 배정·게임·출석 변경을 실시간 반영.
  useRealtimeRefresh(clubId, REALTIME_TABLES);

  const [gameSize, setGameSize] = useState<Record<string, GameSize>>({});
  const [composition, setComposition] = useState<Record<string, Composition>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  // 코트별 패널 모드:
  //  'manual'(직접 배정: 수동 선택만) | 'auto'(자동 배정: 성별구성+자동추천) | 'edit'(진행중 게임 수정)
  const [openCourt, setOpenCourt] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<"manual" | "auto" | "edit">("manual");
  // 코트 이름 편집 상태
  const [renaming, setRenaming] = useState<Record<string, string>>({});

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

  const sizeOf = (courtId: string): GameSize => gameSize[courtId] ?? DEFAULT_GAME_SIZE;
  const compOf = (courtId: string): Composition =>
    composition[courtId] ?? DEFAULT_COMPOSITION;
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

  // 공용 useServerAction에 위임. onStart(패널 닫기 등)·optimistic은 트랜잭션 시작 직후 적용.
  const run = (
    fn: () => Promise<ActionResult>,
    successMsg: string,
    opts?: {
      optimistic?: OptAction;
      onStart?: () => void;
      onSuccess?: () => void;
    },
  ) =>
    runAction(fn, {
      success: successMsg || undefined,
      optimistic:
        opts?.onStart || opts?.optimistic
          ? () => {
              opts?.onStart?.();
              if (opts?.optimistic) applyOptimistic(opts.optimistic);
            }
          : undefined,
      onSuccess: opts?.onSuccess,
    });

  /** 자동 추천: 대기중인 사람만으로 후보를 뽑는다. 수정 모드면 현재 멤버도 후보에 포함. */
  const autoFill = (courtId: string, extra: PoolPlayer[] = []) => {
    const base = [...availablePool];
    for (const e of extra) if (!base.some((p) => p.id === e.id)) base.push(e);
    const rec = recommendGame(base, history, {
      gameSize: sizeOf(courtId),
      composition: compOf(courtId),
      currentSeq,
      // 동률 후보를 섞어 매번 다른 조합 추천(공정성은 유지).
      randomize: true,
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

  const openAssign = (courtId: string, mode: "manual" | "auto") => {
    setOpenMode(mode);
    setOpenCourt(courtId);
    setSelected((p) => ({ ...p, [courtId]: new Set() }));
  };

  const openEdit = (
    courtId: string,
    game: (typeof ongoing)[number],
  ) => {
    setOpenMode("edit");
    setOpenCourt(courtId);
    setGameSize((p) => ({
      ...p,
      [courtId]: (game.players.length === 2 ? 2 : DEFAULT_GAME_SIZE) as GameSize,
    }));
    setSelected((p) => ({
      ...p,
      [courtId]: new Set(game.players.map((pl) => pl.attendanceRecordId)),
    }));
  };

  const closePanel = (courtId: string) => {
    setOpenCourt(null);
    setSelected((p) => ({ ...p, [courtId]: new Set() }));
  };

  const start = (courtId: string) => {
    const ids = [...selOf(courtId)];
    if (ids.length !== sizeOf(courtId)) {
      toast.error(`${sizeOf(courtId)}명을 채워주세요. (현재 ${ids.length}명)`);
      return;
    }
    const players = ids
      .map((id) => poolById.get(id))
      .filter((p): p is PoolPlayer => !!p);
    run(() => startGame(sessionId, courtId, ids), "게임을 시작했습니다.", {
      // 즉시: 패널 닫고 코트에 게임 표시 + 대기열에서 제거
      onStart: () => closePanel(courtId),
      optimistic: {
        type: "start",
        courtId,
        gameId: `opt-${courtId}`,
        players,
      },
    });
  };

  const saveEdit = (courtId: string, gameId: string) => {
    const ids = [...selOf(courtId)];
    if (ids.length !== sizeOf(courtId)) {
      toast.error(`${sizeOf(courtId)}명을 채워주세요. (현재 ${ids.length}명)`);
      return;
    }
    run(() => replaceGamePlayers(gameId, ids), "게임을 수정했습니다.", {
      onStart: () => closePanel(courtId),
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

  /** 대기자 카드 하나(선택 모드면 탭 선택, 평소엔 상태 변경 드롭다운). */
  const renderPoolItem = (p: PoolPlayer) => {
    const activeCourt = openCourt;
    const isPresent = p.status === "present";
    const selectedHere = activeCourt ? selOf(activeCourt).has(p.id) : false;
    const locked = activeCourt ? lockedElsewhere(activeCourt).has(p.id) : false;
    const selectMode = !!activeCourt && (isPresent || selectedHere) && !locked;

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
      locked && activeCourt ? "opacity-40" : "",
    ].join(" ");

    if (activeCourt) {
      return (
        <li key={p.id}>
          <button
            type="button"
            disabled={!selectMode}
            onClick={() => toggleSelect(activeCourt, p.id)}
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
              <DropdownMenuItem
                key={s}
                onClick={() =>
                  run(
                    () => setAttendeeStatus(p.id, s),
                    `${p.name} · ${ATTENDEE_STATUS_LABEL[s]}`,
                    { optimistic: { type: "status", recordId: p.id, status: s } },
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
  };

  // 성별 컬럼(남/여) 한 개 렌더
  const genderColumn = (
    label: string,
    items: PoolPlayer[],
    dotCls: string,
  ) => (
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
    // 드래그로 코트 배정하는 영역 → 탭 스와이프 이동에서 제외.
    <div data-no-swipe className="grid gap-5 lg:grid-cols-12 lg:items-start">
      {/* === 좌측: 대기자 큐 (모바일에선 코트 아래로) === */}
      <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-4">
        <div className="flex flex-col rounded-xl border-2 border-primary/25 bg-card">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight">
                대기자 <span className="text-primary">{availablePool.length}</span>
                <span className="text-muted-foreground">/{pool.length}</span>
              </h2>
              <Users className="size-4 text-muted-foreground" />
            </div>
            {openCourt && (
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
            {!openCourt && availablePool.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                대기자를 누르면 상태(대기중/레슨중/집에감)를 바꿀 수 있습니다.
                오래 기다린 순으로 정렬됩니다.
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* === 우측: 코트 그리드 === */}
      <div className="order-1 lg:order-2 lg:col-span-8">
        {courts.length === 0 && (
          <div className="mb-4 rounded-xl border border-dashed bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium">아직 코트가 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              아래{" "}
              <span className="font-semibold text-foreground">＋ 코트 추가</span>
              로 첫 코트를 만들면 배정을 시작할 수 있어요.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {courts.map((court) => {
            const game = ongoingByCourt.get(court.id);
            const isOpen = openCourt === court.id;
            const isRenaming = renaming[court.id] !== undefined;

            return (
              <div
                key={court.id}
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
                        run(
                          () => renameCourt(court.id, renaming[court.id]),
                          "코트 이름을 변경했습니다.",
                          {
                            onSuccess: () =>
                              setRenaming((p) => {
                                const n = { ...p };
                                delete n[court.id];
                                return n;
                              }),
                          },
                        );
                      }}
                    >
                      <Input
                        value={renaming[court.id]}
                        onChange={(e) =>
                          setRenaming((p) => ({
                            ...p,
                            [court.id]: e.target.value,
                          }))
                        }
                        className="h-8"
                        autoFocus
                        maxLength={30}
                      />
                      <Button type="submit" size="sm" disabled={pending}>
                        저장
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRenaming((p) => {
                            const n = { ...p };
                            delete n[court.id];
                            return n;
                          })
                        }
                      >
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
                              onClick={() =>
                                setRenaming((p) => ({
                                  ...p,
                                  [court.id]: court.name,
                                }))
                              }
                              className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                              aria-label="코트 수정"
                            >
                              <Pencil className="size-4" />
                            </button>
                            {!game && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => deleteCourt(court.id),
                                    "코트를 삭제했습니다.",
                                  )
                                }
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
                      size={sizeOf(court.id)}
                      comp={compOf(court.id)}
                      selectedIds={[...selOf(court.id)]}
                      poolById={poolById}
                      pending={pending}
                      onSizeChange={(s) =>
                        setGameSize((p) => ({ ...p, [court.id]: s }))
                      }
                      onCompChange={(c) =>
                        setComposition((p) => ({ ...p, [court.id]: c }))
                      }
                      onAuto={() =>
                        autoFill(
                          court.id,
                          openMode === "edit" && game
                            ? game.players
                                .map((pl) => poolById.get(pl.attendanceRecordId))
                                .filter((x): x is PoolPlayer => !!x)
                            : [],
                        )
                      }
                      onRemove={(id) => toggleSelect(court.id, id)}
                      onCancel={() => closePanel(court.id)}
                      onSubmit={() =>
                        openMode === "edit" && game
                          ? saveEdit(court.id, game.game.id)
                          : start(court.id)
                      }
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
                          onClick={() => openEdit(court.id, game)}
                        >
                          <Pencil className="size-4" />멤버 수정
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          disabled={pending}
                          onClick={() =>
                            run(() => endGame(game.game.id), "게임을 종료했습니다.", {
                              optimistic: { type: "end", gameId: game.game.id },
                            })
                          }
                        >
                          <Square className="size-4" />종료
                        </Button>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !confirm(
                              "이 게임을 취소할까요? 참가자가 모두 대기로 돌아가며, 기록에 남지 않습니다.",
                            )
                          )
                            return;
                          run(() => cancelGame(game.game.id), "게임을 취소했습니다.", {
                            optimistic: { type: "end", gameId: game.game.id },
                          });
                        }}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />게임 취소 (대기로 되돌리기)
                      </button>
                    </div>
                  ) : (
                    /* 빈 코트 기본: 직접 배정 | 자동 배정 */
                    <div className="flex flex-1 flex-col justify-center gap-3 py-6">
                      <p className="text-center text-sm text-muted-foreground">
                        배정 대기 중
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => openAssign(court.id, "manual")}>
                          <Play className="size-4" />직접 배정
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openAssign(court.id, "auto")}
                        >
                          <Sparkles className="size-4" />자동 배정
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 코트 추가 카드 */}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => addCourt(), "코트를 추가했습니다.")}
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary disabled:opacity-50"
          >
            <Plus className="size-6" />
            <span className="font-semibold">코트 추가</span>
          </button>
        </div>
      </div>
    </div>
  );
}

