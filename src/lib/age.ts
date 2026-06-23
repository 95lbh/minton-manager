/**
 * 나이대 분포 계산 (나이 ≈ 올해 - 출생년도).
 * ※ 생일(월/일)은 저장하지 않고 출생년도만 쓰므로 실제 만 나이와 최대 ±1년 오차가 있다.
 *   분포(나이대) 용도에는 충분하며, 경계 근처 인원이 한 칸 차이날 수 있는 정도다.
 */

export const AGE_BANDS = ["10대", "20대", "30대", "40대", "50대 이상"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** 출생년도 → 나이대 라벨. 출생년도 없으면 null. */
export function ageBandOf(
  birthYear: number | null | undefined,
  currentYear: number,
): AgeBand | null {
  if (!birthYear) return null;
  const age = currentYear - birthYear;
  if (age < 20) return "10대";
  if (age >= 50) return "50대 이상";
  return `${Math.floor(age / 10) * 10}대` as AgeBand;
}

export interface AgeRow {
  label: AgeBand | "미지정";
  count: number;
}

/**
 * 출생년도 목록 → 나이대 분포 행(고정 순서 10대~50대+ + 미지정).
 * "미지정"은 해당하는 사람이 있을 때만 마지막에 추가한다.
 */
export function buildAgeRows(
  birthYears: (number | null | undefined)[],
  currentYear: number,
): AgeRow[] {
  const counts = new Map<AgeBand, number>();
  let unknown = 0;
  for (const by of birthYears) {
    const band = ageBandOf(by, currentYear);
    if (!band) unknown++;
    else counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  const rows: AgeRow[] = AGE_BANDS.map((band) => ({
    label: band,
    count: counts.get(band) ?? 0,
  }));
  if (unknown > 0) rows.push({ label: "미지정", count: unknown });
  return rows;
}
