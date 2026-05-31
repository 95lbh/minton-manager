import { describe, it, expect } from "vitest";
import { makePairs, roundRobin, type LeagueParticipant } from "./league";

function ps(levels: (number | null)[]): LeagueParticipant[] {
  return levels.map((level, i) => ({ id: `p${i}`, level }));
}

describe("makePairs", () => {
  it("짝수: 모두 팀 구성, 미편성 없음", () => {
    const r = makePairs(ps([7, 6, 5, 4, 3, 2]));
    expect(r.pairs).toHaveLength(3);
    expect(r.unpaired).toEqual([]);
    const all = r.pairs.flat().sort();
    expect(all).toEqual(["p0", "p1", "p2", "p3", "p4", "p5"].sort());
  });

  it("홀수: 1명 미편성", () => {
    const r = makePairs(ps([7, 5, 3, 2, 1]));
    expect(r.pairs).toHaveLength(2);
    expect(r.unpaired).toHaveLength(1);
  });

  it("실력 균형: 팀 합계 편차가 작다(강+약)", () => {
    const lv = [7, 6, 5, 4, 3, 2, 1, 0];
    const list = ps(lv);
    const r = makePairs(list);
    const byId = new Map(list.map((p) => [p.id, p.level ?? 4]));
    const sums = r.pairs.map(([a, b]) => byId.get(a)! + byId.get(b)!);
    expect(Math.max(...sums) - Math.min(...sums)).toBeLessThanOrEqual(1);
  });
});

describe("roundRobin", () => {
  it("n<2 이면 빈 결과", () => {
    expect(roundRobin(1)).toEqual([]);
    expect(roundRobin(0)).toEqual([]);
  });

  it("모든 쌍이 정확히 한 번 (C(n,2))", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const pairs = roundRobin(n);
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      const set = new Set(pairs.map(([a, b]) => `${a}-${b}`));
      expect(set.size).toBe(pairs.length); // 중복 없음
      // 모든 인덱스가 등장
      const seen = new Set(pairs.flat());
      expect(seen.size).toBe(n);
    }
  });

  it("결정적", () => {
    expect(roundRobin(5)).toEqual(roundRobin(5));
  });
});
