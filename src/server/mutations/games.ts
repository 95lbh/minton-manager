"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/**
 * 게임 시작 (RPC: games + game_players 트랜잭션, 코트 점유/중복배정 검증).
 * 일반 모드는 팀 구분을 기록하지 않으므로 참가자 전원을 team=1 로 저장한다.
 * (같은 게임에 묶인 쌍 정보는 남아 자동 배정의 반복 회피에 쓰인다.)
 */
export async function startGame(
  sessionId: string,
  courtId: string,
  players: string[],
): Promise<ActionResult> {
  if (players.length < 2) {
    return { ok: false, error: { message: "최소 2명을 배정하세요." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_game", {
    _session_id: sessionId,
    _court_id: courtId,
    _team1: players,
    _team2: [],
  });

  if (error) {
    const message =
      error.message === "court busy"
        ? "이미 진행 중인 게임이 있는 코트입니다."
        : error.message?.includes("uq_active_player")
          ? "이미 다른 게임에 배정된 사람이 있습니다."
          : "게임 시작에 실패했습니다.";
    return { ok: false, error: { message, detail: error.message } };
  }

  revalidatePath(ROUTES.games);
  return { ok: true };
}

/** 진행 중 게임의 참가자 교체 (멤버 변경 / 인원수=종류 변경). RPC 트랜잭션. */
export async function replaceGamePlayers(
  gameId: string,
  players: string[],
): Promise<ActionResult> {
  if (players.length < 2) {
    return { ok: false, error: { message: "최소 2명을 배정하세요." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_game_players", {
    _game_id: gameId,
    _players: players,
  });

  if (error) {
    const message = error.message?.includes("uq_active_player")
      ? "이미 다른 게임에 배정된 사람이 있습니다."
      : "게임 멤버 변경에 실패했습니다.";
    return { ok: false, error: { message, detail: error.message } };
  }

  revalidatePath(ROUTES.games);
  return { ok: true };
}

/** 게임 종료 (RPC: status=finished, 참가자 비활성화 트리거). */
export async function endGame(gameId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_game", { _game_id: gameId });

  if (error)
    return { ok: false, error: { message: "게임 종료에 실패했습니다.", detail: error.message } };

  revalidatePath(ROUTES.games);
  return { ok: true };
}
