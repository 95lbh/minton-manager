import { describe, it, expect } from "vitest";
import { participantsReducer } from "./participants-reducer";
import type { TournamentParticipant } from "@/types/db";

function p(id: string): TournamentParticipant {
  return {
    id,
    club_id: "c",
    tournament_id: "t",
    member_id: id,
    name: id,
    gender: null,
    level: null,
    team: null,
    seed: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("participantsReducer (대회 참가자 낙관적 갱신)", () => {
  it("add: 끝에 추가", () => {
    const next = participantsReducer([p("a")], { type: "add", participant: p("b") });
    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("remove: id로 제거", () => {
    const next = participantsReducer([p("a"), p("b")], { type: "remove", id: "b" });
    expect(next.map((x) => x.id)).toEqual(["a"]);
  });

  it("순수성: 원본 불변", () => {
    const base = [p("a")];
    participantsReducer(base, { type: "remove", id: "a" });
    expect(base.map((x) => x.id)).toEqual(["a"]);
  });
});
