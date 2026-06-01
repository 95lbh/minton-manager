import { describe, it, expect } from "vitest";
import { nextPow2, bracketSeeds, seedPairs } from "./bracket";

describe("nextPow2", () => {
  it("올림 거듭제곱", () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(9)).toBe(16);
  });
});

describe("bracketSeeds", () => {
  it("size=4", () => {
    expect(bracketSeeds(4)).toEqual([1, 4, 2, 3]);
  });
  it("size=8", () => {
    expect(bracketSeeds(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("1..size 순열이며 각 1라운드 쌍의 합 = size+1", () => {
    for (const size of [2, 4, 8, 16]) {
      const s = bracketSeeds(size);
      expect([...s].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i + 1));
      for (let k = 0; k < size / 2; k++) {
        expect(s[2 * k] + s[2 * k + 1]).toBe(size + 1);
      }
    }
  });
});

describe("seedPairs", () => {
  it("8명: 4경기, 부전승 없음", () => {
    const p = seedPairs(8);
    expect(p).toHaveLength(4);
    expect(p.every((x) => x.a != null && x.b != null)).toBe(true);
  });

  it("5명: size 8 → 4경기, 부전승 3 (상위 시드가 부전승)", () => {
    const p = seedPairs(5);
    expect(p).toHaveLength(4);
    const byes = p.filter((x) => x.a == null || x.b == null);
    expect(byes).toHaveLength(3);
    // 부전승 없는 실경기는 시드 4 vs 5
    const real = p.find((x) => x.a != null && x.b != null)!;
    expect([real.a, real.b].sort((a, b) => a! - b!)).toEqual([4, 5]);
    // 부전승-부전승(양쪽 null) 없음
    expect(p.every((x) => x.a != null || x.b != null)).toBe(true);
  });

  it("2명: 1경기", () => {
    expect(seedPairs(2)).toEqual([{ a: 1, b: 2 }]);
  });
});
