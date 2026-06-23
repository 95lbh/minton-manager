import { describe, it, expect } from "vitest";
import { scheduleTeamGames, type SchedParticipant } from "./team-schedule";

type G = SchedParticipant["gender"];
function mk(prefix: string, n: number, gender: G, level = 4): SchedParticipant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, gender, level }));
}

function counts(games: { blue: string[]; white: string[] }[]) {
  const m = new Map<string, number>();
  for (const g of games) [...g.blue, ...g.white].forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
  return m;
}

/** 각 복식 게임이 남복/여복/혼복 중 하나인지 검증 */
function assertValidDoubles(
  games: { blue: string[]; white: string[] }[],
  genderOf: Map<string, G>,
) {
  for (const g of games) {
    expect(g.blue).toHaveLength(2);
    expect(g.white).toHaveLength(2);
    const bg = g.blue.map((id) => genderOf.get(id)).sort();
    const wg = g.white.map((id) => genderOf.get(id)).sort();
    // 양 팀의 성별 구성이 같아야 하고(MM/FF/MF), 청/백이 동일 구성
    expect(bg).toEqual(wg);
    const isMM = bg.every((x) => x === "male");
    const isFF = bg.every((x) => x === "female");
    const isMix = bg[0] === "female" && bg[1] === "male";
    expect(isMM || isFF || isMix).toBe(true);
  }
}

describe("scheduleTeamGames (성별 구성)", () => {
  it("인원 부족이면 사유 반환", () => {
    const r = scheduleTeamGames({
      blue: mk("b", 1, "male"),
      white: mk("w", 1, "male"),
      perSide: 2,
      gamesPerPlayer: 3,
    });
    expect(r.games).toEqual([]);
    expect(r.reason).toBeTruthy();
  });

  it("남복: 모든 게임이 남자 2:2, 인당 보장", () => {
    const blue = mk("b", 4, "male");
    const white = mk("w", 4, "male");
    const g = new Map([...blue, ...white].map((p) => [p.id, p.gender]));
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 4 });
    assertValidDoubles(r.games, g);
    for (const v of counts(r.games).values()) expect(v).toBeGreaterThanOrEqual(4);
  });

  it("혼성 풀: 모든 게임이 남복/여복/혼복 중 하나(3남1녀 없음)", () => {
    const blue = [...mk("bm", 3, "male", 5), ...mk("bf", 3, "female", 4)];
    const white = [...mk("wm", 3, "male", 5), ...mk("wf", 3, "female", 4)];
    const g = new Map([...blue, ...white].map((p) => [p.id, p.gender]));
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 4 });
    expect(r.games.length).toBeGreaterThan(0);
    assertValidDoubles(r.games, g);
    for (const v of counts(r.games).values()) expect(v).toBeGreaterThanOrEqual(4);
  });

  it("성별 미지정은 제외(excluded) 처리", () => {
    const blue = [...mk("bm", 2, "male"), ...mk("bx", 1, null)];
    const white = [...mk("wm", 2, "male"), ...mk("wx", 1, "other")];
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 3 });
    expect(r.excluded).toBe(2);
    // 남자만 게임에 등장
    const ids = new Set(r.games.flatMap((m) => [...m.blue, ...m.white]));
    expect([...ids].every((id) => id.startsWith("bm") || id.startsWith("wm"))).toBe(true);
  });

  it("단식: 동성 매칭(남단/여단), 인당 보장", () => {
    const blue = [...mk("bm", 2, "male"), ...mk("bf", 2, "female")];
    const white = [...mk("wm", 2, "male"), ...mk("wf", 2, "female")];
    const g = new Map([...blue, ...white].map((p) => [p.id, p.gender]));
    const r = scheduleTeamGames({ blue, white, perSide: 1, gamesPerPlayer: 2 });
    for (const m of r.games) {
      expect(m.blue).toHaveLength(1);
      expect(m.white).toHaveLength(1);
      expect(genderEq(g, m)).toBe(true);
    }
    for (const v of counts(r.games).values()) expect(v).toBeGreaterThanOrEqual(2);
  });

  it("결정적: 동일 입력 동일 결과", () => {
    const blue = [...mk("bm", 2, "male"), ...mk("bf", 2, "female")];
    const white = [...mk("wm", 2, "male"), ...mk("wf", 2, "female")];
    const inp = { blue, white, perSide: 2 as const, gamesPerPlayer: 3 };
    expect(scheduleTeamGames(inp)).toEqual(scheduleTeamGames(inp));
  });

  it("균형 지표: 균형 입력은 max==min==목표", () => {
    const blue = mk("b", 4, "male");
    const white = mk("w", 4, "male");
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 4 });
    expect(r.minGames).toBeGreaterThanOrEqual(4);
    expect(r.maxGames).toBe(r.minGames); // 균형이면 동일
  });

  it("균형 지표: 병목 구성이면 일부가 목표 초과(maxGames>목표)", () => {
    // 혼복만 가능(MM/FF 불가)하고 blue 여자·white 남자가 각 1명 → 모든 게임에 강제 투입.
    const blue = [...mk("bm", 4, "male"), ...mk("bf", 1, "female")];
    const white = [...mk("wm", 1, "male"), ...mk("wf", 4, "female")];
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 4 });
    expect(r.minGames).toBeGreaterThanOrEqual(4); // 인당 보장은 충족
    expect(r.maxGames).toBeGreaterThan(4); // 병목 인원은 목표 초과
  });
});

function genderEq(g: Map<string, G>, m: { blue: string[]; white: string[] }) {
  return g.get(m.blue[0]) === g.get(m.white[0]);
}
