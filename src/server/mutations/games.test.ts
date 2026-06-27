import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// next/cache·supabase 서버 클라이언트는 테스트에서 모킹.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { startGame, endGame, cancelGame } from "./games";

const createClientMock = createClient as unknown as Mock;

beforeEach(() => {
  createClientMock.mockReset();
});

describe("startGame", () => {
  it("2명 미만이면 RPC 호출 없이 실패", async () => {
    const rpc = vi.fn();
    createClientMock.mockResolvedValue({ rpc });
    const res = await startGame("s", "c", ["a"]);
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("정상: start_game RPC 호출 후 ok", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ rpc });
    const res = await startGame("s1", "c1", ["a", "b"]);
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("start_game", {
      _session_id: "s1",
      _court_id: "c1",
      _team1: ["a", "b"],
      _team2: [],
    });
  });

  it("court busy 에러를 사용자 메시지로 변환", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "court busy" } });
    createClientMock.mockResolvedValue({ rpc });
    const res = await startGame("s", "c", ["a", "b"]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("이미 진행 중인 게임");
  });
});

describe("endGame", () => {
  it("end_game RPC 호출", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ rpc });
    const res = await endGame("g1");
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("end_game", { _game_id: "g1" });
  });
});

describe("cancelGame", () => {
  function chain(result: { error: unknown }) {
    const eq2 = vi.fn().mockResolvedValue(result);
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const update = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ update }));
    return { from, update, eq1, eq2 };
  }

  it("진행 중 게임만 canceled 로 업데이트", async () => {
    const c = chain({ error: null });
    createClientMock.mockResolvedValue({ from: c.from });
    const res = await cancelGame("g9");
    expect(res.ok).toBe(true);
    expect(c.from).toHaveBeenCalledWith("games");
    expect(c.update).toHaveBeenCalledWith({ status: "canceled" });
    expect(c.eq1).toHaveBeenCalledWith("id", "g9");
    expect(c.eq2).toHaveBeenCalledWith("status", "ongoing");
  });

  it("DB 에러면 실패 반환", async () => {
    const c = chain({ error: { message: "db" } });
    createClientMock.mockResolvedValue({ from: c.from });
    const res = await cancelGame("g9");
    expect(res.ok).toBe(false);
  });
});
