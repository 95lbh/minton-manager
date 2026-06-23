import { describe, it, expect } from "vitest";
import {
  recommendGame,
  recommendRound,
  pairKey,
  EMPTY_HISTORY,
  type PlayerState,
  type PairHistory,
  type AssignmentOptions,
} from "./assignment";

// 테스트용 플레이어 빌더
function player(
  id: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    name: id,
    gender: null,
    skill: 3,
    gamesPlayed: 0,
    lastPlayedSeq: null,
    ...overrides,
  };
}

const baseOptions: AssignmentOptions = {
  gameSize: 4,
  composition: "free",
  currentSeq: 1,
};

function teamOf(rec: { teams: { teamA: string[]; teamB: string[] } }, id: string) {
  if (rec.teams.teamA.includes(id)) return "A";
  if (rec.teams.teamB.includes(id)) return "B";
  return null;
}

describe("recommendGame — 기본", () => {
  it("인원이 부족하면 null", () => {
    const players = [player("a"), player("b"), player("c")];
    expect(recommendGame(players, EMPTY_HISTORY, baseOptions)).toBeNull();
  });

  it("4명이면 한 게임을 구성한다", () => {
    const players = ["a", "b", "c", "d"].map((id) => player(id));
    const rec = recommendGame(players, EMPTY_HISTORY, baseOptions);
    expect(rec).not.toBeNull();
    expect(rec!.players).toHaveLength(4);
    expect(rec!.teams.teamA).toHaveLength(2);
    expect(rec!.teams.teamB).toHaveLength(2);
  });
});

describe("공정성", () => {
  it("가장 오래 기다린 사람(anchor)은 반드시 포함된다", () => {
    // e: 0게임(최우선), 나머지는 이미 여러 게임 뜀
    const players = [
      player("a", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("b", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("c", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("d", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("e", { gamesPlayed: 0, lastPlayedSeq: null }),
    ];
    const rec = recommendGame(players, EMPTY_HISTORY, baseOptions);
    expect(rec!.players).toContain("e");
  });

  it("randomize=true 여도 적게 친 사람이 우선된다(공정성 유지)", () => {
    const players = [
      player("a", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("b", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("c", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("d", { gamesPlayed: 3, lastPlayedSeq: 3 }),
      player("e", { gamesPlayed: 0, lastPlayedSeq: null }),
    ];
    // 여러 번 돌려도 0게임 e는 항상 포함되어야 한다.
    for (let i = 0; i < 20; i++) {
      const rec = recommendGame(players, EMPTY_HISTORY, {
        ...baseOptions,
        randomize: true,
      });
      expect(rec!.players).toContain("e");
    }
  });
});

describe("파트너 중복 회피", () => {
  it("이미 파트너였던 둘을 같은 팀에 두지 않는다(대안이 있으면)", () => {
    const players = ["a", "b", "c", "d"].map((id) => player(id));
    const history: PairHistory = {
      partnerCount: { [pairKey("a", "b")]: 1 },
      opponentCount: {},
      lastPartnerSeq: { [pairKey("a", "b")]: 0 },
      lastOpponentSeq: {},
    };
    const rec = recommendGame(players, history, baseOptions);
    expect(teamOf(rec!, "a")).not.toBe(teamOf(rec!, "b"));
    expect(rec!.warnings).toHaveLength(0); // 중복 없이 구성됨
  });
});

describe("실력 균형", () => {
  it("강-약을 팀에 고르게 분배한다", () => {
    const players = [
      player("strong1", { skill: 5 }),
      player("strong2", { skill: 5 }),
      player("weak1", { skill: 1 }),
      player("weak2", { skill: 1 }),
    ];
    const rec = recommendGame(players, EMPTY_HISTORY, {
      ...baseOptions,
      weights: undefined,
    });
    const skill: Record<string, number> = {
      strong1: 5,
      strong2: 5,
      weak1: 1,
      weak2: 1,
    };
    const sumA = rec!.teams.teamA.reduce((s, id) => s + skill[id], 0);
    const sumB = rec!.teams.teamB.reduce((s, id) => s + skill[id], 0);
    expect(sumA).toBe(sumB); // 6 vs 6
  });
});

describe("혼복(mixed)", () => {
  it("각 팀이 남1 여1로 구성된다", () => {
    const players = [
      player("m1", { gender: "male" }),
      player("m2", { gender: "male" }),
      player("f1", { gender: "female" }),
      player("f2", { gender: "female" }),
    ];
    const rec = recommendGame(players, EMPTY_HISTORY, {
      ...baseOptions,
      composition: "mixed",
    });
    expect(rec).not.toBeNull();
    const gender: Record<string, string> = {
      m1: "male",
      m2: "male",
      f1: "female",
      f2: "female",
    };
    for (const team of [rec!.teams.teamA, rec!.teams.teamB]) {
      const males = team.filter((id) => gender[id] === "male").length;
      const females = team.filter((id) => gender[id] === "female").length;
      expect(males).toBe(1);
      expect(females).toBe(1);
    }
  });

  it("성비가 안 맞으면 null", () => {
    const players = [
      player("m1", { gender: "male" }),
      player("m2", { gender: "male" }),
      player("m3", { gender: "male" }),
      player("f1", { gender: "female" }),
    ];
    const rec = recommendGame(players, EMPTY_HISTORY, {
      ...baseOptions,
      composition: "mixed",
    });
    expect(rec).toBeNull();
  });

  it("혼복: 상위 window가 남성에 쏠려도 window를 넓혀 유효 조합을 찾는다", () => {
    // 남성 8명(게임 0) 뒤로 여성 2명(게임 9) → 기본 window(8)엔 남성만.
    const males = Array.from({ length: 8 }, (_, i) =>
      player(`m${i}`, { gender: "male", gamesPlayed: 0 }),
    );
    const females = [
      player("f1", { gender: "female", gamesPlayed: 9 }),
      player("f2", { gender: "female", gamesPlayed: 9 }),
    ];
    const all = [...males, ...females];
    const gmap = new Map(all.map((p) => [p.id, p.gender]));
    const rec = recommendGame(all, EMPTY_HISTORY, {
      ...baseOptions,
      composition: "mixed",
    });
    expect(rec).not.toBeNull();
    const fem = rec!.players.filter((id) => gmap.get(id) === "female").length;
    const mal = rec!.players.filter((id) => gmap.get(id) === "male").length;
    expect(fem).toBe(2);
    expect(mal).toBe(2);
  });
});

describe("남복/여복 필터", () => {
  it("남복은 남성만 선택하고 여성은 제외한다", () => {
    const players = [
      player("m1", { gender: "male" }),
      player("m2", { gender: "male" }),
      player("m3", { gender: "male" }),
      player("m4", { gender: "male" }),
      player("f1", { gender: "female" }),
    ];
    const rec = recommendGame(players, EMPTY_HISTORY, {
      ...baseOptions,
      composition: "mens",
    });
    expect(rec).not.toBeNull();
    expect(rec!.players).not.toContain("f1");
    expect(rec!.excluded.some((e) => e.id === "f1")).toBe(true);
  });
});

describe("단식(gameSize 2)", () => {
  it("1대1 게임을 구성한다", () => {
    const players = [player("a"), player("b")];
    const rec = recommendGame(players, EMPTY_HISTORY, {
      ...baseOptions,
      gameSize: 2,
    });
    expect(rec!.teams.teamA).toHaveLength(1);
    expect(rec!.teams.teamB).toHaveLength(1);
  });
});

describe("recommendRound — 멀티 코트", () => {
  it("코트 2개에 겹치지 않게 배정한다", () => {
    const players = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) =>
      player(id),
    );
    const games = recommendRound(players, EMPTY_HISTORY, 2, baseOptions);
    expect(games).toHaveLength(2);
    const all = games.flatMap((g) => g.players);
    expect(new Set(all).size).toBe(8); // 중복 없음
  });

  it("인원이 부족한 코트는 건너뛴다", () => {
    const players = ["a", "b", "c", "d", "e"].map((id) => player(id));
    const games = recommendRound(players, EMPTY_HISTORY, 2, baseOptions);
    expect(games).toHaveLength(1); // 5명 → 1게임만
  });
});
