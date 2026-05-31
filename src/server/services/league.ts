/**
 * 리그전(round-robin) 편성 보조 (순수 함수, DB 비의존 — 단위 테스트 가능).
 *  - makePairs: 복식용 실력 균형 2인 팀 구성(강+약 접기).
 *  - roundRobin: 모든 유닛이 서로 한 번씩 — 서클 방식으로 라운드별 정렬.
 */
import { DEFAULT_LEVEL } from "./team-split";

export interface LeagueParticipant {
  id: string;
  level: number | null;
}

const lvl = (p: LeagueParticipant) => p.level ?? DEFAULT_LEVEL;

/**
 * 실력 균형 2인 팀: 실력 내림차순 정렬 후 양끝을 묶어(강+약) 팀별 합이 비슷하게.
 * 홀수면 가운데 1명은 미편성(unpaired).
 */
export function makePairs(participants: LeagueParticipant[]): {
  pairs: [string, string][];
  unpaired: string[];
} {
  const sorted = [...participants].sort(
    (a, b) => lvl(b) - lvl(a) || (a.id < b.id ? -1 : 1),
  );
  const pairs: [string, string][] = [];
  let i = 0;
  let j = sorted.length - 1;
  while (i < j) {
    pairs.push([sorted[i].id, sorted[j].id]);
    i++;
    j--;
  }
  const unpaired = i === j ? [sorted[i].id] : [];
  return { pairs, unpaired };
}

/**
 * n개 유닛의 라운드로빈 대진(서클 방식). 모든 쌍이 정확히 한 번.
 * 반환: [i, j] 유닛 인덱스 쌍 목록(라운드 순서대로).
 */
export function roundRobin(n: number): [number, number][] {
  if (n < 2) return [];
  const arr: number[] = [...Array(n).keys()];
  if (n % 2 === 1) arr.push(-1); // bye 자리
  const m = arr.length;
  const half = m / 2;
  const rounds = m - 1;
  const result: [number, number][] = [];
  let order = [...arr];
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < half; k++) {
      const a = order[k];
      const b = order[m - 1 - k];
      if (a !== -1 && b !== -1) result.push(a < b ? [a, b] : [b, a]);
    }
    // 첫 자리 고정하고 회전
    order = [order[0], order[m - 1], ...order.slice(1, m - 1)];
  }
  return result;
}
