import { describe, it, expect } from "vitest";
import { optimisticReducer, toOngoingPlayers } from "./court-board-reducer";
import type { CourtViewData, PoolPlayer } from "@/server/queries/games";

function pool(id: string, status = "present"): PoolPlayer {
  return {
    id,
    name: id,
    gender: "male",
    skill: 4,
    gamesPlayed: 0,
    waitingSince: null,
    status,
    isGuest: false,
  } as unknown as PoolPlayer;
}

function base(): CourtViewData {
  return {
    courts: [],
    ongoing: [],
    pool: [pool("a"), pool("b"), pool("c"), pool("d")],
    currentSeq: 1,
    history: { partner: {}, opponent: {} } as unknown as CourtViewData["history"],
  };
}

describe("toOngoingPlayers", () => {
  it("앞 절반=1팀, 뒤 절반=2팀", () => {
    const players = toOngoingPlayers([pool("a"), pool("b"), pool("c"), pool("d")]);
    expect(players.map((p) => p.team)).toEqual([1, 1, 2, 2]);
    expect(players[0].attendanceRecordId).toBe("a");
  });
});

describe("optimisticReducer", () => {
  it("start: 게임 추가 + 배정자 풀에서 제거", () => {
    const next = optimisticReducer(base(), {
      type: "start",
      courtId: "court1",
      gameId: "g1",
      players: [pool("a"), pool("b")],
    });
    expect(next.ongoing).toHaveLength(1);
    expect(next.ongoing[0].game.court_id).toBe("court1");
    expect(next.pool.map((p) => p.id)).toEqual(["c", "d"]); // a,b 제거
  });

  it("end: 해당 게임 카드 제거", () => {
    const withGame = optimisticReducer(base(), {
      type: "start",
      courtId: "court1",
      gameId: "g1",
      players: [pool("a")],
    });
    const next = optimisticReducer(withGame, { type: "end", gameId: "g1" });
    expect(next.ongoing).toHaveLength(0);
  });

  it("status: 해당 대기자 상태만 변경", () => {
    const next = optimisticReducer(base(), {
      type: "status",
      recordId: "a",
      status: "left",
    });
    expect(next.pool.find((p) => p.id === "a")?.status).toBe("left");
    expect(next.pool.find((p) => p.id === "b")?.status).toBe("present");
  });
});
