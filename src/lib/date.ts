/**
 * 운영 기준 "오늘" 날짜 (YYYY-MM-DD).
 *
 * 동호회 운영 특성상 자정이 아니라 **한국시간(KST, UTC+9) 오전 6시**에 날짜가 바뀐다.
 * 즉 새벽 게임(예: 02:00)은 전날 운영일에 묶이고, 오전 6시를 지나야 새 운영일이 된다.
 *
 * 계산: KST 06:00을 자정으로 보이게 하려면 (UTC+9 - 6h) = UTC+3 만큼 시프트한 뒤
 * UTC 날짜를 취한다. toISOString()은 항상 UTC라 서버 타임존에 영향받지 않는다.
 */
export const DAY_BOUNDARY_HOUR_KST = 6;

export function operatingDate(now: Date = new Date()): string {
  const shiftHours = 9 - DAY_BOUNDARY_HOUR_KST; // UTC+3
  const shifted = new Date(now.getTime() + shiftHours * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
