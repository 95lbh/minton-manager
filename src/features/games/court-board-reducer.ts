import type {
  CourtViewData,
  OngoingGameView,
  PoolPlayer,
} from "@/server/queries/games";

/** 코트 화면 낙관적 갱신 액션(서버 응답 전 즉시 반영, 이후 revalidate로 동기화). */
export type OptAction =
  | { type: "start"; courtId: string; gameId: string; players: PoolPlayer[] }
  | { type: "end"; gameId: string }
  | { type: "status"; recordId: string; status: string };

/** 대기자(PoolPlayer) → 진행중 게임 표시용 플레이어. 앞 절반=1팀, 뒤 절반=2팀. */
export function toOngoingPlayers(players: PoolPlayer[]) {
  const half = Math.ceil(players.length / 2);
  return players.map((p, i) => ({
    attendanceRecordId: p.id,
    name: p.name,
    gender: p.gender ?? null,
    level: p.skill ?? null,
    team: i < half ? 1 : 2,
  }));
}

export function optimisticReducer(
  state: CourtViewData,
  action: OptAction,
): CourtViewData {
  switch (action.type) {
    case "start": {
      const ids = new Set(action.players.map((p) => p.id));
      // 표시에 필요한 필드만 채운 임시 게임(서버 revalidate로 곧 대체됨).
      const game: OngoingGameView = {
        game: {
          id: action.gameId,
          court_id: action.courtId,
          status: "ongoing",
          started_at: new Date().toISOString(),
        },
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
