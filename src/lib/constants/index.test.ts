import { describe, it, expect } from "vitest";
import {
  SKILL_GRADES,
  SKILL_VALUE,
  GRADE_BY_VALUE,
  isPublicPath,
} from "./index";

describe("등급 ↔ 숫자 변환", () => {
  it("등급→숫자→등급 왕복이 보존된다", () => {
    for (const grade of SKILL_GRADES) {
      expect(GRADE_BY_VALUE[SKILL_VALUE[grade]]).toBe(grade);
    }
  });

  it("S=7(최고) … F=1(최저)", () => {
    expect(SKILL_VALUE.S).toBe(7);
    expect(SKILL_VALUE.F).toBe(1);
    expect(GRADE_BY_VALUE[7]).toBe("S");
    expect(GRADE_BY_VALUE[1]).toBe("F");
  });
});

describe("isPublicPath", () => {
  it("홈·로그인·인증·법적고지는 공개", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
  });

  it("운영 경로는 보호", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/members")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });
});
