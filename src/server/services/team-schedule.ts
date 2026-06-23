/**
 * 청팀/백팀 게임 편성 (순수 함수, DB 비의존 — 단위 테스트 가능).
 *
 * 규칙:
 *  - 각 게임은 유효한 성별 구성만: 복식=남복(M,M)/여복(F,F)/혼복(M,F), 단식=남단(M)/여단(F).
 *    (예: 남3·여1 같은 게임은 만들지 않음)
 *  - 인당 게임 수 보장: 편성 가능한 참가자는 최소 gamesPerPlayer 게임.
 *  - 게임 수 균등: 매 게임 가장 적게 뛴 후보 우선(공정성 최우선).
 *  - 실력 매칭: 같은 게임의 청/백 평균 실력이 비슷하게(동률 후보 중 근접 선택).
 *
 * 성별이 male/female가 아닌(미지정/기타) 참가자는 유효 구성에 넣을 수 없어 편성에서 제외(excluded).
 */
import { DEFAULT_LEVEL } from "./team-split";

export interface SchedParticipant {
  id: string;
  gender: "male" | "female" | "other" | null;
  level: number | null;
}

export interface ScheduledGame {
  blue: string[];
  white: string[];
}

export interface ScheduleResult {
  games: ScheduledGame[];
  /** 성별 미지정 등으로 편성에서 제외된 인원 수 */
  excluded: number;
  reason?: string;
  /** 편성 대상 중 최다/최소 게임 수(균형 지표). 게임 없으면 0. */
  maxGames: number;
  minGames: number;
}

type Comp = "mens" | "womens" | "mixed";

const lvl = (p: SchedParticipant) => p.level ?? DEFAULT_LEVEL;
const avg = (ps: SchedParticipant[]) =>
  ps.reduce((s, p) => s + lvl(p), 0) / Math.max(1, ps.length);

export function scheduleTeamGames(input: {
  blue: SchedParticipant[];
  white: SchedParticipant[];
  perSide: 1 | 2;
  gamesPerPlayer: number;
}): ScheduleResult {
  const { blue, white, perSide, gamesPerPlayer } = input;

  const blueM = blue.filter((p) => p.gender === "male");
  const blueF = blue.filter((p) => p.gender === "female");
  const whiteM = white.filter((p) => p.gender === "male");
  const whiteF = white.filter((p) => p.gender === "female");
  const usable = blueM.length + blueF.length + whiteM.length + whiteF.length;
  const excluded = blue.length + white.length - usable;

  if (gamesPerPlayer < 1) return { games: [], excluded, maxGames: 0, minGames: 0 };

  // 구성별 인원 요건
  const need = perSide; // 복식=2, 단식=1
  const canMM = blueM.length >= need && whiteM.length >= need;
  const canFF = blueF.length >= need && whiteF.length >= need;
  const canMix =
    perSide === 2 &&
    blueM.length >= 1 &&
    blueF.length >= 1 &&
    whiteM.length >= 1 &&
    whiteF.length >= 1;

  if (!canMM && !canFF && !canMix) {
    return {
      games: [],
      excluded,
      maxGames: 0,
      minGames: 0,
      reason: "유효한 성별 구성(남복/여복/혼복)을 만들 인원이 부족합니다.",
    };
  }

  const count = new Map<string, number>();
  [...blueM, ...blueF, ...whiteM, ...whiteF].forEach((p) => count.set(p.id, 0));

  const maleSchedulable = canMM || canMix;
  const femaleSchedulable = canFF || canMix;
  const schedulable = new Set<string>();
  if (maleSchedulable) [...blueM, ...whiteM].forEach((p) => schedulable.add(p.id));
  if (femaleSchedulable) [...blueF, ...whiteF].forEach((p) => schedulable.add(p.id));

  if (schedulable.size === 0) {
    return {
      games: [],
      excluded,
      maxGames: 0,
      minGames: 0,
      reason: "편성 가능한 참가자가 없습니다.",
    };
  }

  // 게임 수 적은 순 → (목표 실력 근접) → 실력 → id
  const pick = (
    pool: SchedParticipant[],
    k: number,
    target: number | null,
  ): SchedParticipant[] =>
    [...pool]
      .sort((a, b) => {
        const c = (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0);
        if (c !== 0) return c;
        if (target != null) {
          const d = Math.abs(lvl(a) - target) - Math.abs(lvl(b) - target);
          if (d !== 0) return d;
        }
        return lvl(a) - lvl(b) || (a.id < b.id ? -1 : 1);
      })
      .slice(0, k);

  const build = (comp: Comp): ScheduledGame => {
    if (comp === "mens") {
      const b = pick(blueM, need, null);
      const w = pick(whiteM, need, avg(b));
      return { blue: b.map((p) => p.id), white: w.map((p) => p.id) };
    }
    if (comp === "womens") {
      const b = pick(blueF, need, null);
      const w = pick(whiteF, need, avg(b));
      return { blue: b.map((p) => p.id), white: w.map((p) => p.id) };
    }
    // mixed (복식 전용): 각 팀 1남 1녀
    const bm = pick(blueM, 1, null);
    const bf = pick(blueF, 1, null);
    const t = avg([...bm, ...bf]);
    const wm = pick(whiteM, 1, t);
    const wf = pick(whiteF, 1, t);
    return { blue: [...bm, ...bf].map((p) => p.id), white: [...wm, ...wf].map((p) => p.id) };
  };

  const feasible: Comp[] = [];
  if (canMM) feasible.push("mens");
  if (canFF) feasible.push("womens");
  if (canMix) feasible.push("mixed");

  const minCount = () =>
    Math.min(...[...schedulable].map((id) => count.get(id) ?? 0));

  const games: ScheduledGame[] = [];
  const maxIter = gamesPerPlayer * schedulable.size + 100;
  let iter = 0;

  while (minCount() < gamesPerPlayer && iter < maxIter) {
    iter++;
    // 후보 구성 중, 선발 인원의 누적 게임수 합이 가장 작은(=가장 뒤처진) 구성 선택
    let best: ScheduledGame | null = null;
    let bestScore = Infinity;
    for (const comp of feasible) {
      const g = build(comp);
      const ids = [...g.blue, ...g.white];
      const score = ids.reduce((s, id) => s + (count.get(id) ?? 0), 0);
      if (score < bestScore) {
        bestScore = score;
        best = g;
      }
    }
    if (!best) break;
    [...best.blue, ...best.white].forEach((id) =>
      count.set(id, (count.get(id) ?? 0) + 1),
    );
    games.push(best);
  }

  const counts = [...schedulable].map((id) => count.get(id) ?? 0);
  const maxGames = counts.length ? Math.max(...counts) : 0;
  const minGames = counts.length ? Math.min(...counts) : 0;

  return { games, excluded, maxGames, minGames };
}
