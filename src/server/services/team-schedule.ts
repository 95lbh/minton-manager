/**
 * 청팀/백팀 게임 편성 (순수 함수, DB 비의존 — 단위 테스트 가능).
 *
 * 목표:
 *  - 인당 게임 수 보장: 모든 참가자가 최소 gamesPerPlayer 게임.
 *  - 게임 수 균등: 가장 적게 뛴 사람을 항상 우선 → 편차 최소.
 *  - 실력 매칭: 같은 게임의 청/백 실력이 비슷하게(동률 후보 중 실력 근접 선택).
 *
 * 우선순위: 공정성(게임 수)이 항상 우선, 실력 매칭은 동률 후보 내 tie-break.
 */
import { DEFAULT_LEVEL } from "./team-split";

export interface SchedParticipant {
  id: string;
  level: number | null;
}

export interface ScheduledGame {
  blue: string[];
  white: string[];
}

export interface ScheduleResult {
  games: ScheduledGame[];
  reason?: string;
}

const lvl = (p: SchedParticipant) => p.level ?? DEFAULT_LEVEL;

/**
 * 한 팀에서 perSide명 선발: 게임 수 적은 순(공정성) → (목표 실력 근접 / 실력) tie-break.
 */
function pick(
  pool: SchedParticipant[],
  count: Map<string, number>,
  perSide: number,
  targetLevel: number | null,
): SchedParticipant[] {
  const sorted = [...pool].sort((a, b) => {
    const c = (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0);
    if (c !== 0) return c; // 게임 수 적은 사람 우선(공정성)
    if (targetLevel != null) {
      const d = Math.abs(lvl(a) - targetLevel) - Math.abs(lvl(b) - targetLevel);
      if (d !== 0) return d; // 목표 실력에 가까운 사람
    }
    return lvl(a) - lvl(b) || (a.id < b.id ? -1 : 1);
  });
  return sorted.slice(0, perSide);
}

export function scheduleTeamGames(input: {
  blue: SchedParticipant[];
  white: SchedParticipant[];
  perSide: 1 | 2;
  gamesPerPlayer: number;
}): ScheduleResult {
  const { blue, white, perSide, gamesPerPlayer } = input;

  if (blue.length < perSide || white.length < perSide) {
    return { games: [], reason: "각 팀에 인원이 부족합니다." };
  }
  if (gamesPerPlayer < 1) return { games: [] };

  // 인당 gamesPerPlayer 보장에 필요한 게임 수.
  // 팀별 슬롯 = perSide * G. perSide*G >= gamesPerPlayer * 팀인원 이어야 모두 보장.
  const maxTeam = Math.max(blue.length, white.length);
  const totalGames = Math.ceil((gamesPerPlayer * maxTeam) / perSide);

  const count = new Map<string, number>();
  [...blue, ...white].forEach((p) => count.set(p.id, 0));

  const games: ScheduledGame[] = [];
  for (let g = 0; g < totalGames; g++) {
    const bsel = pick(blue, count, perSide, null);
    const targetAvg =
      bsel.reduce((s, p) => s + lvl(p), 0) / bsel.length;
    const wsel = pick(white, count, perSide, targetAvg);

    bsel.forEach((p) => count.set(p.id, (count.get(p.id) ?? 0) + 1));
    wsel.forEach((p) => count.set(p.id, (count.get(p.id) ?? 0) + 1));

    games.push({ blue: bsel.map((p) => p.id), white: wsel.map((p) => p.id) });
  }

  return { games };
}
