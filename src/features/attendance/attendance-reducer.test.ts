import { describe, it, expect } from "vitest";
import { recordsReducer } from "./attendance-reducer";
import type { AttendanceRecordView } from "@/server/queries/attendance";

function rec(id: string): AttendanceRecordView {
  return {
    id,
    session_id: "s",
    club_id: "c",
    member_id: id,
    guest_name: null,
    guest_gender: null,
    guest_level: null,
    is_guest: false,
    checked_in_at: "2026-01-01T00:00:00Z",
    status: "present",
    member: null,
  };
}

describe("recordsReducer (출석 낙관적 갱신)", () => {
  it("add: 목록 끝에 추가", () => {
    const next = recordsReducer([rec("a")], { type: "add", record: rec("b") });
    expect(next.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("remove: id로 제거", () => {
    const next = recordsReducer([rec("a"), rec("b")], { type: "remove", id: "a" });
    expect(next.map((r) => r.id)).toEqual(["b"]);
  });

  it("순수성: 원본 배열을 변형하지 않는다", () => {
    const base = [rec("a")];
    recordsReducer(base, { type: "add", record: rec("b") });
    expect(base.map((r) => r.id)).toEqual(["a"]);
  });

  it("없는 id remove는 그대로", () => {
    const next = recordsReducer([rec("a")], { type: "remove", id: "x" });
    expect(next.map((r) => r.id)).toEqual(["a"]);
  });
});
