/**
 * 청팀/백팀 균형 분배 (순수 함수, DB 비의존 — 단위 테스트 가능).
 *
 * 목표: 두 팀의 (1) 성비와 (2) 실력 분포가 서로 고르게.
 * 방식: 성별 그룹별로 실력 내림차순 정렬 후, 각 그룹을 두 팀에 번갈아 배정한다.
 *  - 같은 성별 인원이 적은 팀을 우선(→ 팀별 성비 균형)
 *  - 인원이 같으면 누적 실력이 낮은 팀을 우선(→ 강한 선수가 약한 팀으로, 실력 균형)
 * 결정적(deterministic): 동률은 항상 청팀(blue) 우선.
 */

export type Team = "blue" | "white";
export type SplitGender = "male" | "female" | "other";

export interface SplitParticipant {
  id: string;
  gender: SplitGender | null;
  /** 1~7 (F~S). null/미상은 기본값으로 처리 */
  level: number | null;
}

export interface TeamSummary {
  count: number;
  male: number;
  female: number;
  other: number;
  /** 평균 레벨(1~7). 인원 0이면 0 */
  avgLevel: number;
}

export interface SplitResult {
  /** participantId → team */
  assignment: Record<string, Team>;
  blue: string[];
  white: string[];
  summary: { blue: TeamSummary; white: TeamSummary };
}

/** 레벨 미상 기본값(중간값). 1~7 척도의 중앙. */
export const DEFAULT_LEVEL = 4;

const lvl = (p: SplitParticipant) => p.level ?? DEFAULT_LEVEL;
const genderKey = (g: SplitGender | null): SplitGender => g ?? "other";

interface TeamAcc {
  ids: string[];
  byGender: Record<SplitGender, number>;
  totalLevel: number;
}

function emptyAcc(): TeamAcc {
  return { ids: [], byGender: { male: 0, female: 0, other: 0 }, totalLevel: 0 };
}

function summarize(
  acc: TeamAcc,
  byId: Map<string, SplitParticipant>,
): TeamSummary {
  const count = acc.ids.length;
  const sumLevel = acc.ids.reduce((s, id) => s + lvl(byId.get(id)!), 0);
  return {
    count,
    male: acc.byGender.male,
    female: acc.byGender.female,
    other: acc.byGender.other,
    avgLevel: count === 0 ? 0 : Math.round((sumLevel / count) * 10) / 10,
  };
}

export function splitTeams(participants: SplitParticipant[]): SplitResult {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const blue = emptyAcc();
  const white = emptyAcc();

  // 성별 그룹별 처리 (혼성 균형). 그룹 순서 고정.
  const genders: SplitGender[] = ["male", "female", "other"];
  for (const g of genders) {
    const group = participants
      .filter((p) => genderKey(p.gender) === g)
      // 실력 내림차순, 동률은 id로 안정 정렬(결정적)
      .sort((a, b) => lvl(b) - lvl(a) || (a.id < b.id ? -1 : 1));

    for (const p of group) {
      const bg = blue.byGender[g];
      const wg = white.byGender[g];
      let target: TeamAcc;
      if (bg !== wg) {
        target = bg < wg ? blue : white; // 해당 성별 적은 팀 우선
      } else {
        target = blue.totalLevel <= white.totalLevel ? blue : white; // 실력 낮은 팀 우선
      }
      target.ids.push(p.id);
      target.byGender[g] += 1;
      target.totalLevel += lvl(p);
    }
  }

  const assignment: Record<string, Team> = {};
  for (const id of blue.ids) assignment[id] = "blue";
  for (const id of white.ids) assignment[id] = "white";

  return {
    assignment,
    blue: blue.ids,
    white: white.ids,
    summary: { blue: summarize(blue, byId), white: summarize(white, byId) },
  };
}
