import type { AttendanceRecordView } from "@/server/queries/attendance";

/** 낙관적 출석 갱신: 서버 응답 전 목록을 즉시 반영(이후 revalidate로 동기화). */
export type RecAction =
  | { type: "add"; record: AttendanceRecordView }
  | { type: "remove"; id: string };

export function recordsReducer(
  state: AttendanceRecordView[],
  action: RecAction,
): AttendanceRecordView[] {
  switch (action.type) {
    case "add":
      return [...state, action.record];
    case "remove":
      return state.filter((r) => r.id !== action.id);
    default:
      return state;
  }
}
