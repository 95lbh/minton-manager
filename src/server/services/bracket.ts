/**
 * 싱글 엘리미네이션 브래킷 시드 배치 (순수 함수, DB 비의존 — 단위 테스트 가능).
 * 표준 시드 순서로 1번 시드와 2번 시드가 결승까지 만나지 않도록 배치한다.
 */

/** n 이상의 최소 2의 거듭제곱 */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * size(2^k) 브래킷의 슬롯 순서별 시드 번호.
 * 예: 4 → [1,4,2,3], 8 → [1,8,4,5,2,7,3,6].
 */
export function bracketSeeds(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(n + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * 참가 유닛 수 count에 대한 1라운드 대진(시드 쌍).
 * a/b는 1-based 시드 번호. 시드가 count를 넘으면 null(부전승 상대).
 */
export function seedPairs(count: number): { a: number | null; b: number | null }[] {
  if (count < 2) return [];
  const size = nextPow2(count);
  const slots = bracketSeeds(size);
  const pairs: { a: number | null; b: number | null }[] = [];
  for (let k = 0; k < size / 2; k++) {
    const sa = slots[2 * k];
    const sb = slots[2 * k + 1];
    pairs.push({ a: sa <= count ? sa : null, b: sb <= count ? sb : null });
  }
  return pairs;
}
