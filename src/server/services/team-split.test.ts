import { describe, it, expect } from "vitest";
import { splitTeams, type SplitParticipant } from "./team-split";

function mk(id: string, gender: SplitParticipant["gender"], level: number | null): SplitParticipant {
  return { id, gender, level };
}

describe("splitTeams", () => {
  it("빈 입력은 빈 팀", () => {
    const r = splitTeams([]);
    expect(r.blue).toEqual([]);
    expect(r.white).toEqual([]);
    expect(r.summary.blue.count).toBe(0);
  });

  it("모든 참가자가 정확히 한 팀에 배정된다(중복/누락 없음)", () => {
    const ps = Array.from({ length: 9 }, (_, i) => mk(`p${i}`, i % 2 ? "male" : "female", (i % 7) + 1));
    const r = splitTeams(ps);
    const all = [...r.blue, ...r.white].sort();
    expect(all).toEqual(ps.map((p) => p.id).sort());
    expect(new Set(all).size).toBe(ps.length);
  });

  it("인원 차이는 최대 1 (균등 분배)", () => {
    const ps = Array.from({ length: 11 }, (_, i) => mk(`p${i}`, "male", 4));
    const r = splitTeams(ps);
    expect(Math.abs(r.summary.blue.count - r.summary.white.count)).toBeLessThanOrEqual(1);
  });

  it("성별이 양 팀에 고르게 분배된다", () => {
    // 남 6, 여 4
    const males = Array.from({ length: 6 }, (_, i) => mk(`m${i}`, "male", 4));
    const females = Array.from({ length: 4 }, (_, i) => mk(`f${i}`, "female", 4));
    const r = splitTeams([...males, ...females]);
    expect(Math.abs(r.summary.blue.male - r.summary.white.male)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.summary.blue.female - r.summary.white.female)).toBeLessThanOrEqual(1);
  });

  it("실력이 양 팀에 균형 있게 분배된다(평균 차이 작음)", () => {
    // 레벨 1~7 다양
    const ps = [7, 7, 6, 6, 5, 5, 4, 4, 3, 2, 1, 1].map((lv, i) => mk(`p${i}`, "male", lv));
    const r = splitTeams(ps);
    expect(Math.abs(r.summary.blue.avgLevel - r.summary.white.avgLevel)).toBeLessThanOrEqual(1);
  });

  it("level null은 기본값으로 처리되어 균형 유지", () => {
    const ps = Array.from({ length: 8 }, (_, i) => mk(`p${i}`, "male", null));
    const r = splitTeams(ps);
    expect(r.summary.blue.count).toBe(4);
    expect(r.summary.white.count).toBe(4);
  });

  it("결정적: 동일 입력은 동일 결과", () => {
    const ps = [5, 3, 7, 1, 6, 2].map((lv, i) => mk(`p${i}`, i % 2 ? "female" : "male", lv));
    expect(splitTeams(ps).assignment).toEqual(splitTeams(ps).assignment);
  });
});
