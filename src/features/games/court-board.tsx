"use client";

import { useMemo, useOptimistic, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  DEFAULT_COMPOSITION,
  ATTENDEE_STATUS_LABEL,
  type Composition,
} from "@/lib/constants";
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
import { PoolSection } from "@/features/games/pool-section";
import { CourtCard } from "@/features/games/court-card";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/server/types";

// 코트 화면에 영향을 주는 테이블(실시간 구독 대상).
const REALTIME_TABLES = [
  "games",
  "game_players",
  "attendance_records",
  "courts",
] as const;

// 빈 Set 상수(코트 패널 미열림 시 PoolSection에 안정적으로 전달).
const EMPTY_SET: Set<string> = new Set();

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

  // 코트 이름 편집 종료(상태에서 해당 코트 키 제거).
  const clearRenaming = (courtId: string) =>
    setRenaming((p) => {
      const n = { ...p };
      delete n[courtId];
      return n;
    });

  return (
    // 드래그로 코트 배정하는 영역 → 탭 스와이프 이동에서 제외.
    <div data-no-swipe className="grid gap-5 lg:grid-cols-12 lg:items-start">
      {/* 좌측: 대기자 큐 */}
      <PoolSection
        pool={pool}
        availableCount={availablePool.length}
        panelOpen={openCourt !== null}
        selectedIds={openCourt ? selOf(openCourt) : EMPTY_SET}
        lockedIds={openCourt ? lockedElsewhere(openCourt) : EMPTY_SET}
        pending={pending}
        onToggleSelect={(id) => openCourt && toggleSelect(openCourt, id)}
        onSetStatus={(p, s) =>
          run(
            () => setAttendeeStatus(p.id, s),
            `${p.name} · ${ATTENDEE_STATUS_LABEL[s]}`,
            { optimistic: { type: "status", recordId: p.id, status: s } },
          )
        }
      />

      {/* 우측: 코트 그리드 */}
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
            return (
              <CourtCard
                key={court.id}
                court={court}
                game={game}
                isOpen={openCourt === court.id}
                openMode={openMode}
                renamingValue={renaming[court.id]}
                size={sizeOf(court.id)}
                comp={compOf(court.id)}
                selectedIds={[...selOf(court.id)]}
                poolById={poolById}
                pending={pending}
                onRenameStart={() =>
                  setRenaming((p) => ({ ...p, [court.id]: court.name }))
                }
                onRenameChange={(v) =>
                  setRenaming((p) => ({ ...p, [court.id]: v }))
                }
                onRenameCancel={() => clearRenaming(court.id)}
                onRenameSubmit={() =>
                  run(
                    () => renameCourt(court.id, renaming[court.id]),
                    "코트 이름을 변경했습니다.",
                    { onSuccess: () => clearRenaming(court.id) },
                  )
                }
                onDelete={() =>
                  run(() => deleteCourt(court.id), "코트를 삭제했습니다.")
                }
                onEdit={() => game && openEdit(court.id, game)}
                onOpenAssign={(mode) => openAssign(court.id, mode)}
                onEndGame={() =>
                  game &&
                  run(() => endGame(game.game.id), "게임을 종료했습니다.", {
                    optimistic: { type: "end", gameId: game.game.id },
                  })
                }
                onCancelGame={() => {
                  if (!game) return;
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
                onRemoveSelected={(id) => toggleSelect(court.id, id)}
                onClosePanel={() => closePanel(court.id)}
                onSubmit={() =>
                  openMode === "edit" && game
                    ? saveEdit(court.id, game.game.id)
                    : start(court.id)
                }
              />
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

