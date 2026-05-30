/** Server Action 공통 반환 타입. architecture.md §6 응답 규칙. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: { message: string; detail?: string } };
