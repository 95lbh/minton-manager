/**
 * 코트 자동 배정 알고리즘 (순수 함수, DB 비의존 — 단위 테스트 가능).
 * 룰 원본: docs/assignment.md
 *
 * 공정성(후보 선정) 과 품질(팀 구성: 중복/실력)을 분리한다.
 */
import { DEFAULT_SKILL_VALUE, type Composition } from "@/lib/constants";

export type Gender = "male" | "female" | "other";
export type GameSize = 2 | 4;
/** 기본 게임 인원(복식 4명). */
export const DEFAULT_GAME_SIZE: GameSize = 4;

/** 배정 단위 1명. id는 보통 attendance_record_id. skill은 1~5(D~S). */
export interface PlayerState {
  id: string;
  name: string;
  gender: Gender | null;
  /** 1~5 (D~S). null/미상은 DEFAULT_SKILL_VALUE 로 처리 */
  skill: number | null;
  /** 이번 세션 누적 게임 수 */
  gamesPlayed: number;
  /** 마지막으로 뛴 게임 순번. 한 번도 안 뛰었으면 null */
  lastPlayedSeq: number | null;
  /** 대기 시작(또는 출석) 시각 ms — 동률 tiebreak용 (선택) */
  waitingSince?: number;
  /** 수동 고정: 이 사람은 반드시 포함 */
  locked?: boolean;
}

/** 오늘 세션 내 페어 이력. key = pairKey(a,b) */
export interface PairHistory {
  partnerCount: Record<string, number>;
  opponentCount: Record<string, number>;
  /** 마지막으로 같은 팀이었던 게임 순번 */
  lastPartnerSeq?: Record<string, number>;
  /** 마지막으로 상대였던 게임 순번 */
  lastOpponentSeq?: Record<string, number>;
}

export interface Weights {
  partner: number;
  opponent: number;
  skill: number;
  spread: number;
  recencyHalfLife: number;
}

export const WEIGHT_PRESETS: Record<"balanced" | "skill" | "variety", Weights> =
  {
    balanced: { partner: 10, opponent: 4, skill: 2, spread: 1, recencyHalfLife: 3 },
    skill: { partner: 8, opponent: 3, skill: 6, spread: 3, recencyHalfLife: 3 },
    variety: { partner: 14, opponent: 8, skill: 1, spread: 0.5, recencyHalfLife: 4 },
  };

export const EMPTY_HISTORY: PairHistory = {
  partnerCount: {},
  opponentCount: {},
  lastPartnerSeq: {},
  lastOpponentSeq: {},
};

export interface AssignmentOptions {
  gameSize: GameSize;
  composition: Composition;
  /** 현재(다음) 게임 순번 — 최신성 계산 기준 */
  currentSeq: number;
  weights?: Weights;
  /** 후보 window 여유 (기본 gameSize) */
  windowSlack?: number;
  /**
   * 동률(같은 게임수·마지막 순번) 후보를 무작위로 섞어 매번 다른 조합이 나오게 한다.
   * 공정성은 유지: 적게 친 사람이 항상 먼저. (테스트는 미사용 → 결정적)
   */
  randomize?: boolean;
}

export interface TeamSplit {
  teamA: string[];
  teamB: string[];
}

export interface GameRecommendation {
  players: string[];
  teams: TeamSplit;
  cost: number;
  reasons: string[];
  warnings: string[];
  excluded: { id: string; reason: string }[];
  alternatives: { teams: TeamSplit; cost: number }[];
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function skillOf(p: PlayerState): number {
  return p.skill ?? DEFAULT_SKILL_VALUE;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const recurse = (start: number) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

/** 4인을 두 팀(2+2)으로 나누는 3가지 분할. 2인은 1가지. */
function teamSplits(players: PlayerState[]): [PlayerState[], PlayerState[]][] {
  if (players.length === 2) {
    return [[[players[0]], [players[1]]]];
  }
  const [p0, p1, p2, p3] = players;
  return [
    [
      [p0, p1],
      [p2, p3],
    ],
    [
      [p0, p2],
      [p1, p3],
    ],
    [
      [p0, p3],
      [p1, p2],
    ],
  ];
}

const isMale = (p: PlayerState) => p.gender === "male";
const isFemale = (p: PlayerState) => p.gender === "female";

/** composition 에 맞는 후보만 남긴다. mixed 는 남/녀만 사용(other 제외). */
function filterByComposition(
  players: PlayerState[],
  composition: Composition,
): { eligible: PlayerState[]; excluded: { id: string; reason: string }[] } {
  const excluded: { id: string; reason: string }[] = [];
  const eligible: PlayerState[] = [];
  for (const p of players) {
    if (composition === "mens" && !isMale(p)) {
      excluded.push({ id: p.id, reason: "남복 모드: 남성 아님" });
    } else if (composition === "womens" && !isFemale(p)) {
      excluded.push({ id: p.id, reason: "여복 모드: 여성 아님" });
    } else if (composition === "mixed" && !isMale(p) && !isFemale(p)) {
      excluded.push({ id: p.id, reason: "혼복 모드: 성별 미지정" });
    } else {
      eligible.push(p);
    }
  }
  return { eligible, excluded };
}

/** Fisher-Yates 셔플(제자리). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 공정성 정렬: 게임수 asc → 마지막게임순번 asc(미출전 우선) → 대기시작 asc.
 * randomize=true 면 사전 셔플 후 (게임수·순번)만으로 안정 정렬 →
 * 완전 동률 후보들은 무작위 순서가 유지된다(세션 초반 변화 확보).
 */
function fairnessSort(players: PlayerState[], randomize = false): PlayerState[] {
  const arr = randomize ? shuffle([...players]) : [...players];
  return arr.sort((a, b) => {
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    const la = a.lastPlayedSeq ?? -1;
    const lb = b.lastPlayedSeq ?? -1;
    if (la !== lb) return la - lb;
    return randomize ? 0 : (a.waitingSince ?? 0) - (b.waitingSince ?? 0);
  });
}

/** 혼복 유효 조합(인원)인지: 정확히 절반이 남, 절반이 여 */
function isValidMixedCombo(combo: PlayerState[]): boolean {
  const males = combo.filter(isMale).length;
  const females = combo.filter(isFemale).length;
  return males === combo.length / 2 && females === combo.length / 2;
}

/** 혼복 유효 분할인지: 각 팀에 남1 여1 (복식) / 단식은 조합단계에서 남1여1 보장 */
function isValidMixedSplit(
  teamA: PlayerState[],
  teamB: PlayerState[],
): boolean {
  const ok = (team: PlayerState[]) =>
    team.length === 1
      ? true
      : team.filter(isMale).length === 1 && team.filter(isFemale).length === 1;
  return ok(teamA) && ok(teamB);
}

// ---------------------------------------------------------------------------
// 점수 계산
// ---------------------------------------------------------------------------
function recencyMultiplier(
  lastSeq: number | undefined,
  currentSeq: number,
  halfLife: number,
): number {
  if (lastSeq == null) return 1;
  const gap = currentSeq - lastSeq;
  return 1 + Math.max(0, (halfLife - gap) / halfLife);
}

interface CostBreakdown {
  cost: number;
  partnerRepeats: number;
  opponentRepeats: number;
  skillDiff: number;
}

function scoreSplit(
  teamA: PlayerState[],
  teamB: PlayerState[],
  history: PairHistory,
  weights: Weights,
  currentSeq: number,
): CostBreakdown {
  let partnerPenalty = 0;
  let partnerRepeats = 0;
  let opponentPenalty = 0;
  let opponentRepeats = 0;

  const scanTeam = (team: PlayerState[]) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = pairKey(team[i].id, team[j].id);
        const c = history.partnerCount[key] ?? 0;
        if (c > 0) {
          partnerRepeats += c;
          partnerPenalty +=
            c *
            recencyMultiplier(
              history.lastPartnerSeq?.[key],
              currentSeq,
              weights.recencyHalfLife,
            );
        }
      }
    }
  };
  scanTeam(teamA);
  scanTeam(teamB);

  for (const a of teamA) {
    for (const b of teamB) {
      const key = pairKey(a.id, b.id);
      const c = history.opponentCount[key] ?? 0;
      if (c > 0) {
        opponentRepeats += c;
        opponentPenalty +=
          c *
          recencyMultiplier(
            history.lastOpponentSeq?.[key],
            currentSeq,
            weights.recencyHalfLife,
          );
      }
    }
  }

  const sumA = teamA.reduce((s, p) => s + skillOf(p), 0);
  const sumB = teamB.reduce((s, p) => s + skillOf(p), 0);
  const skillDiff = Math.abs(sumA - sumB);

  const all = [...teamA, ...teamB].map(skillOf);
  const spread = Math.max(...all) - Math.min(...all);

  const cost =
    weights.partner * partnerPenalty +
    weights.opponent * opponentPenalty +
    weights.skill * skillDiff +
    weights.spread * spread;

  return { cost, partnerRepeats, opponentRepeats, skillDiff };
}

// ---------------------------------------------------------------------------
// 메인: 단일 코트 추천
// ---------------------------------------------------------------------------
interface ScoredGame {
  players: PlayerState[];
  split: [PlayerState[], PlayerState[]];
  breakdown: CostBreakdown;
}

export function recommendGame(
  waiting: PlayerState[],
  history: PairHistory,
  options: AssignmentOptions,
): GameRecommendation | null {
  const { gameSize, composition, currentSeq } = options;
  const weights = options.weights ?? WEIGHT_PRESETS.balanced;
  const slack = options.windowSlack ?? gameSize;

  const { eligible, excluded } = filterByComposition(waiting, composition);
  if (eligible.length < gameSize) return null;

  const sorted = fairnessSort(eligible, options.randomize);
  const locked = sorted.filter((p) => p.locked);
  if (locked.length > gameSize) return null;

  const anchors = new Set(locked.map((p) => p.id));
  if (anchors.size === 0 && sorted.length > 0) anchors.add(sorted[0].id);

  // window: 상위 K + anchor 보장.
  // 혼복 등에서 현재 window에 유효 조합(성비)이 없으면 window를 넓혀 재시도한다.
  // (상위 K가 한쪽 성별에 쏠려도, 아래쪽의 다른 성별까지 포함해 가능한 조합을 찾음)
  let windowSize = Math.min(sorted.length, gameSize + slack);
  let best: ScoredGame | null = null;
  let scored: ScoredGame[] = [];

  while (true) {
    const windowSet = new Map<string, PlayerState>();
    for (const p of sorted.slice(0, windowSize)) windowSet.set(p.id, p);
    for (const p of sorted) if (anchors.has(p.id)) windowSet.set(p.id, p);
    const windowArr = [...windowSet.values()];

    best = null;
    scored = [];
    for (const combo of combinations(windowArr, gameSize)) {
      if (![...anchors].every((id) => combo.some((p) => p.id === id))) continue;
      if (composition === "mixed" && !isValidMixedCombo(combo)) continue;

      for (const [teamA, teamB] of teamSplits(combo)) {
        if (composition === "mixed" && !isValidMixedSplit(teamA, teamB)) continue;
        const breakdown = scoreSplit(teamA, teamB, history, weights, currentSeq);
        const entry: ScoredGame = {
          players: combo,
          split: [teamA, teamB],
          breakdown,
        };
        scored.push(entry);
        if (!best || breakdown.cost < best.breakdown.cost) best = entry;
      }
    }

    // 찾았거나 더 넓힐 수 없으면 종료. 아니면 한 단계(gameSize)씩 확대 재시도.
    if (best || windowSize >= sorted.length) break;
    windowSize = Math.min(sorted.length, windowSize + gameSize);
  }

  if (!best) return null; // 유효 조합이 정말 없음(예: 혼복인데 한쪽 성별 부족)

  scored.sort((a, b) => a.breakdown.cost - b.breakdown.cost);
  const chosenIds = new Set(best.players.map((p) => p.id));
  for (const p of eligible) {
    if (!chosenIds.has(p.id)) excluded.push({ id: p.id, reason: "다음 차례 대기" });
  }

  return {
    players: best.players.map((p) => p.id),
    teams: {
      teamA: best.split[0].map((p) => p.id),
      teamB: best.split[1].map((p) => p.id),
    },
    cost: best.breakdown.cost,
    reasons: buildReasons(best.breakdown, options),
    warnings: buildWarnings(best.breakdown),
    excluded,
    alternatives: scored.slice(1, 3).map((s) => ({
      teams: {
        teamA: s.split[0].map((p) => p.id),
        teamB: s.split[1].map((p) => p.id),
      },
      cost: s.breakdown.cost,
    })),
  };
}

// ---------------------------------------------------------------------------
// 멀티 코트: 그리디 라운드 배정
// ---------------------------------------------------------------------------
export function recommendRound(
  waiting: PlayerState[],
  history: PairHistory,
  courtCount: number,
  options: AssignmentOptions,
): GameRecommendation[] {
  const results: GameRecommendation[] = [];
  let pool = [...waiting];
  for (let i = 0; i < courtCount; i++) {
    const rec = recommendGame(pool, history, {
      ...options,
      currentSeq: options.currentSeq + i,
    });
    if (!rec) break;
    results.push(rec);
    const used = new Set(rec.players);
    pool = pool.filter((p) => !used.has(p.id));
  }
  return results;
}

function buildReasons(b: CostBreakdown, options: AssignmentOptions): string[] {
  return [
    `공정성: 가장 오래 기다린 ${options.gameSize}명 우선 배정`,
    b.partnerRepeats === 0 ? "파트너 중복 없음" : `파트너 중복 ${b.partnerRepeats}회`,
    b.opponentRepeats === 0 ? "상대 중복 없음" : `상대 중복 ${b.opponentRepeats}회`,
    `팀 실력차 ${b.skillDiff}`,
  ];
}

function buildWarnings(b: CostBreakdown): string[] {
  const warnings: string[] = [];
  if (b.partnerRepeats > 0)
    warnings.push(`파트너 중복 ${b.partnerRepeats}회 (대기 인원 한계)`);
  if (b.opponentRepeats > 0)
    warnings.push(`상대 중복 ${b.opponentRepeats}회 (대기 인원 한계)`);
  return warnings;
}
