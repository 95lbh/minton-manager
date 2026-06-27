import type { TournamentParticipant } from "@/types/db";

/** 낙관적 참가자 목록 갱신(서버 응답 전 즉시 반영, 이후 revalidate로 동기화). */
export type PAction =
  | { type: "add"; participant: TournamentParticipant }
  | { type: "remove"; id: string };

export function participantsReducer(
  state: TournamentParticipant[],
  action: PAction,
): TournamentParticipant[] {
  if (action.type === "add") return [...state, action.participant];
  return state.filter((p) => p.id !== action.id);
}
