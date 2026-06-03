"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Square,
  Play,
  X,
  Check,
  Clock,
  Trash2,
  Plus,
  Pencil,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { WaitTime } from "@/features/games/wait-time";
import { genderAvatarClass } from "@/components/person-avatar";
import { recommendGame, type GameSize } from "@/server/services/assignment";
import {
  startGame,
  endGame,
  replaceGamePlayers,
} from "@/server/mutations/games";
import { addCourt, deleteCourt, renameCourt } from "@/server/mutations/courts";
import { setAttendeeStatus } from "@/server/mutations/attendance";
import type {
  CourtViewData,
  PoolPlayer,
  OngoingGameView,
} from "@/server/queries/games";
import type { Game } from "@/types/db";

const SIZE_LABEL: Record<number, string> = { 4: "복식", 2: "단식" };

const STATUS_BADGE: Record<string, string> = {
  present: "",
  lesson: "bg-blue-100 text-blue-700",
  left: "bg-zinc-200 text-zinc-600",
};

const avatarCls = genderAvatarClass;

// ── 낙관적 UI ──────────────────────────────────────────────
// 서버 응답 전에 화면을 즉시 갱신한다. 서버 액션의 revalidate가 돌아오면
// useOptimistic 이 실제 데이터로 자연 동기화한다.
type OptAction =
  | { type: "start"; courtId: string; gameId: string; players: PoolPlayer[] }
  | { type: "end"; gameId: string }
  | { type: "status"; recordId: string; status: string };

/** 대기자(PoolPlayer) → 진행중 게임 표시용 플레이어. 앞 절반=1팀, 뒤 절반=2팀. */
function toOngoingPlayers(players: PoolPlayer[]) {
  const half = Math.ceil(players.length / 2);
  return players.map((p, i) => ({
    attendanceRecordId: p.id,
    name: p.name,
    gender: p.gender ?? null,
    level: p.skill ?? null,
    team: i < half ? 1 : 2,
  }));
}

function optimisticReducer(
  state: CourtViewData,
  action: OptAction,
): CourtViewData {
  switch (action.type) {
    case "start": {
      const ids = new Set(action.players.map((p) => p.id));
      // 표시에 필요한 필드만 채운 임시 게임(서버 revalidate로 곧 대체됨).
      const stub = {
        id: action.gameId,
        court_id: action.courtId,
        status: "ongoing",
        started_at: new Date().toISOString(),
      } as unknown as Game;
      const game: OngoingGameView = {
        game: stub,
        players: toOngoingPlayers(action.players),
      };
      return {
        ...state,
        ongoing: [...state.ongoing, game],
        pool: state.pool.filter((p) => !ids.has(p.id)),
      };
    }
    case "end":
      // 카드만 즉시 제거. 대기열 복귀는 revalidate가 정확히 채운다.
      return {
        ...state,
        ongoing: state.ongoing.filter((o) => o.game.id !== action.gameId),
      };
    case "status":
      return {
        ...state,
        pool: state.pool.map((p) =>
          p.id === action.recordId ? { ...p, status: action.status } : p,
        ),
      };
    default:
      return state;
  }
}

export function CourtBoard({
  sessionId,
  data,
}: {
  sessionId: string;
  data: CourtViewData;
}) {
  const [optData, applyOptimistic] = useOptimistic(data, optimisticReducer);
  const { courts, ongoing, pool, currentSeq, history } = optData;
  const [pending, startTransition] = useTransition();

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

  const sizeOf = (courtId: string): GameSize => gameSize[courtId] ?? 4;
  const compOf = (courtId: string): Composition => composition[courtId] ?? "mens";
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

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMsg: string,
    opts?: {
      /** 즉시(awati 전) 적용할 낙관적 갱신 */
      optimistic?: OptAction;
      /** 즉시 실행(패널 닫기 등 UI 반응) */
      onStart?: () => void;
      /** 성공 후 실행 */
      onSuccess?: () => void;
    },
  ) => {
    startTransition(async () => {
      opts?.onStart?.();
      if (opts?.optimistic) applyOptimistic(opts.optimistic);
      const res = await fn();
      if (res.ok) {
        if (successMsg) toast.success(successMsg);
        opts?.onSuccess?.();
        // revalidatePath(서버 액션)로 화면이 자동 갱신되므로 router.refresh() 불필요.
      } else {
        toast.error(res.error?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  /** 자동 추천: 대기중인 사람만으로 후보를 뽑는다. 수정 모드면 현재 멤버도 후보에 포함. */
  const autoFill = (courtId: string, extra: PoolPlayer[] = []) => {
    const base = [...availablePool];
    for (const e of extra) if (!base.some((p) => p.id === e.id)) base.push(e);
    const rec = recommendGame(base, history, {
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
      [courtId]: (game.players.length === 2 ? 2 : 4) as GameSize,
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
    <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
      {/* === 좌측: 대기자 큐 (모바일에선 코트 아래로) === */}
      <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-4">
        <div className="flex flex-col rounded-xl border bg-card">
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

/**
 * 배정/수정 패널.
 * - 직접 배정(manual): 단복식 선택 + 수동 탭 선택만 (자동추천/성별구성 없음)
 * - 자동 배정(auto)/수정(edit): 단복식 + 성별구성 셀렉트 + 자동 배정 추천 버튼
 */
function AssignPanel({
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
            onValueChange={(v) => onSizeChange((v === "2" ? 2 : 4) as GameSize)}
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
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onAuto}
          >
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
