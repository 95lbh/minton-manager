import { describe, it, expect } from "vitest";
import { scheduleTeamGames, type SchedParticipant } from "./team-schedule";

function team(prefix: string, n: number, level = 4): SchedParticipant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, level }));
}

function counts(games: { blue: string[]; white: string[] }[]) {
  const m = new Map<string, number>();
  for (const g of games) [...g.blue, ...g.white].forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
  return m;
}

describe("scheduleTeamGames", () => {
  it("인원 부족이면 빈 결과 + 사유", () => {
    const r = scheduleTeamGames({ blue: team("b", 1), white: team("w", 3), perSide: 2, gamesPerPlayer: 3 });
    expect(r.games).toEqual([]);
    expect(r.reason).toBeTruthy();
  });

  it("복식: 각 게임은 청2·백2, 같은 게임에 중복 인물 없음", () => {
    const r = scheduleTeamGames({ blue: team("b", 4), white: team("w", 4), perSide: 2, gamesPerPlayer: 4 });
    expect(r.games.length).toBeGreaterThan(0);
    for (const g of r.games) {
      expect(g.blue).toHaveLength(2);
      expect(g.white).toHaveLength(2);
      expect(new Set([...g.blue, ...g.white]).size).toBe(4);
    }
  });

  it("모든 참가자가 인당 게임수 이상 보장된다(복식)", () => {
    const r = scheduleTeamGames({ blue: team("b", 5), white: team("w", 6), perSide: 2, gamesPerPlayer: 5 });
    const c = counts(r.games);
    for (const v of c.values()) expect(v).toBeGreaterThanOrEqual(5);
  });

  it("게임 수 편차가 작다(균등 분포)", () => {
    const r = scheduleTeamGames({ blue: team("b", 5), white: team("w", 5), perSide: 2, gamesPerPlayer: 4 });
    const vals = [...counts(r.games).values()];
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2);
  });

  it("단식: 각 게임은 청1·백1, 인당 보장", () => {
    const r = scheduleTeamGames({ blue: team("b", 3), white: team("w", 4), perSide: 1, gamesPerPlayer: 3 });
    for (const g of r.games) {
      expect(g.blue).toHaveLength(1);
      expect(g.white).toHaveLength(1);
    }
    const c = counts(r.games);
    for (const v of c.values()) expect(v).toBeGreaterThanOrEqual(3);
  });

  it("실력 매칭: 청/백 평균 실력 차가 작다", () => {
    // 다양한 레벨
    const blue = [7, 6, 5, 4, 3, 2].map((lv, i) => ({ id: `b${i}`, level: lv }));
    const white = [7, 6, 5, 4, 3, 2].map((lv, i) => ({ id: `w${i}`, level: lv }));
    const r = scheduleTeamGames({ blue, white, perSide: 2, gamesPerPlayer: 4 });
    const lvlOf = new Map([...blue, ...white].map((p) => [p.id, p.level]));
    for (const g of r.games) {
      const ba = g.blue.reduce((s, id) => s + lvlOf.get(id)!, 0) / g.blue.length;
      const wa = g.white.reduce((s, id) => s + lvlOf.get(id)!, 0) / g.white.length;
      expect(Math.abs(ba - wa)).toBeLessThanOrEqual(2);
    }
  });

  it("결정적: 동일 입력 동일 결과", () => {
    const inp = { blue: team("b", 4), white: team("w", 4), perSide: 2 as const, gamesPerPlayer: 3 };
    expect(scheduleTeamGames(inp)).toEqual(scheduleTeamGames(inp));
  });
});
