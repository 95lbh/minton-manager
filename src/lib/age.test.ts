import { describe, it, expect } from "vitest";
import { ageBandOf, buildAgeRows, AGE_BANDS } from "./age";

const YEAR = 2026;

describe("ageBandOf", () => {
  it("출생년도가 없으면 null", () => {
    expect(ageBandOf(null, YEAR)).toBeNull();
    expect(ageBandOf(undefined, YEAR)).toBeNull();
    expect(ageBandOf(0, YEAR)).toBeNull();
  });

  it("나이대를 만 나이 기준으로 분류한다", () => {
    expect(ageBandOf(2010, YEAR)).toBe("10대"); // 16세
    expect(ageBandOf(2005, YEAR)).toBe("20대"); // 21세
    expect(ageBandOf(1996, YEAR)).toBe("30대"); // 30세
    expect(ageBandOf(1986, YEAR)).toBe("40대"); // 40세
    expect(ageBandOf(1976, YEAR)).toBe("50대 이상"); // 50세
    expect(ageBandOf(1950, YEAR)).toBe("50대 이상"); // 76세
  });

  it("경계값: 20세 미만은 10대, 50세 이상은 묶음", () => {
    expect(ageBandOf(2007, YEAR)).toBe("10대"); // 19세
    expect(ageBandOf(2006, YEAR)).toBe("20대"); // 20세
    expect(ageBandOf(1977, YEAR)).toBe("40대"); // 49세
    expect(ageBandOf(1976, YEAR)).toBe("50대 이상"); // 50세
  });
});

describe("buildAgeRows", () => {
  it("항상 고정 5개 밴드를 순서대로 반환한다", () => {
    const rows = buildAgeRows([], YEAR);
    expect(rows.map((r) => r.label)).toEqual([...AGE_BANDS]);
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });

  it("미지정은 해당자가 있을 때만 마지막에 추가된다", () => {
    const withUnknown = buildAgeRows([2000, null], YEAR);
    expect(withUnknown.at(-1)).toEqual({ label: "미지정", count: 1 });

    const noUnknown = buildAgeRows([2000, 1990], YEAR);
    expect(noUnknown.some((r) => r.label === "미지정")).toBe(false);
  });

  it("나이대별로 정확히 집계한다", () => {
    const rows = buildAgeRows([2005, 2004, 1996, null], YEAR);
    const get = (label: string) =>
      rows.find((r) => r.label === label)?.count ?? 0;
    expect(get("20대")).toBe(2); // 2005, 2004
    expect(get("30대")).toBe(1); // 1996
    expect(get("미지정")).toBe(1); // null
  });
});
