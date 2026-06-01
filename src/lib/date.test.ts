import { describe, it, expect } from "vitest";
import { operatingDate } from "./date";

/** KST 시각을 Date(UTC 내부값)로 만든다. */
function kst(y: number, mo: number, d: number, h: number, mi = 0): Date {
  // KST = UTC+9 → UTC = KST - 9h
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}

describe("operatingDate — KST 오전 6시 경계", () => {
  it("오전 6시 이후는 그날 운영일", () => {
    expect(operatingDate(kst(2026, 6, 2, 6, 0))).toBe("2026-06-02");
    expect(operatingDate(kst(2026, 6, 2, 9, 30))).toBe("2026-06-02");
    expect(operatingDate(kst(2026, 6, 2, 23, 59))).toBe("2026-06-02");
  });

  it("자정~오전 6시 이전은 전날 운영일(늦은 밤 게임 유지)", () => {
    // 6/3 00:30, 05:59 KST → 아직 6/2 운영일
    expect(operatingDate(kst(2026, 6, 3, 0, 30))).toBe("2026-06-02");
    expect(operatingDate(kst(2026, 6, 3, 5, 59))).toBe("2026-06-02");
  });

  it("오전 6시 정각에 새 운영일로 전환", () => {
    expect(operatingDate(kst(2026, 6, 3, 5, 59))).toBe("2026-06-02");
    expect(operatingDate(kst(2026, 6, 3, 6, 0))).toBe("2026-06-03");
  });

  it("월말 경계도 정확", () => {
    expect(operatingDate(kst(2026, 7, 1, 3, 0))).toBe("2026-06-30");
    expect(operatingDate(kst(2026, 7, 1, 6, 0))).toBe("2026-07-01");
  });
});
