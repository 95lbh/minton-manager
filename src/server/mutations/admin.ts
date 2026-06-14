"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub, isActiveClubOwner } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";
import type { MemberGender } from "@/types/db";

/** 되돌릴 수 없는 일괄 초기화는 소유자만. (공동관리자도 차단) */
const OWNER_ONLY_ERROR = {
  message: "클럽 소유자만 초기화할 수 있습니다.",
} as const;

/** 초기화/시드 후 영향받는 화면 일괄 갱신. */
function revalidateOperational() {
  revalidatePath(ROUTES.members);
  revalidatePath(ROUTES.stats);
  revalidatePath(ROUTES.games);
  revalidatePath(ROUTES.attendance);
  revalidatePath(ROUTES.dashboard);
}

/**
 * 회원 목록 초기화 — 활성 회원 전부 soft delete.
 * 과거 출석/게임 기록은 보존되며, 회원만 목록에서 사라진다.
 */
export async function resetMembers(): Promise<ActionResult<{ count: number }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };
  if (!(await isActiveClubOwner())) return { ok: false, error: OWNER_ONLY_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("club_id", club.id)
    .is("deleted_at", null)
    .select("id");

  if (error)
    return {
      ok: false,
      error: { message: "회원 목록 초기화에 실패했습니다.", detail: error.message },
    };

  revalidateOperational();
  return { ok: true, data: { count: data?.length ?? 0 } };
}

/**
 * 데이터(통계) 초기화 — 출석 세션 전부 삭제.
 * FK cascade 로 출석 레코드·게임·게임참가자까지 함께 삭제되어 통계가 0이 된다.
 * (대회 모드 기록은 별도라 영향 없음)
 */
export async function resetStatsData(): Promise<ActionResult<{ count: number }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };
  if (!(await isActiveClubOwner())) return { ok: false, error: OWNER_ONLY_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .delete()
    .eq("club_id", club.id)
    .select("id");

  if (error)
    return {
      ok: false,
      error: { message: "데이터 초기화에 실패했습니다.", detail: error.message },
    };

  revalidateOperational();
  return { ok: true, data: { count: data?.length ?? 0 } };
}

// ---- 신규 클럽: 샘플 데이터로 둘러보기 ----

// 둘러보기용 고정 샘플 회원(이름·성별·급수·출생년도). 실제 운영 전 체험용.
const SAMPLE_MEMBERS = [
  { name: "김민준", gender: "male", level: 6, birth_year: 1990 },
  { name: "이서연", gender: "female", level: 5, birth_year: 1994 },
  { name: "박도윤", gender: "male", level: 4, birth_year: 1988 },
  { name: "최지우", gender: "female", level: 4, birth_year: 1999 },
  { name: "정현우", gender: "male", level: 3, birth_year: 1985 },
  { name: "강하은", gender: "female", level: 3, birth_year: 2001 },
  { name: "조서준", gender: "male", level: 2, birth_year: 1996 },
  { name: "윤채원", gender: "female", level: 2, birth_year: 1992 },
] as const;

/**
 * 신규(빈) 클럽에 샘플 회원·코트를 한 번에 생성한다. 둘러보기용.
 * 이미 데이터가 있으면 중복 생성을 막기 위해 거절한다.
 */
export async function seedSampleData(): Promise<
  ActionResult<{ members: number; courts: number }>
> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  // 빈 클럽에서만 허용(실수로 기존 데이터에 섞이지 않도록).
  const [{ count: memberCnt }, { count: courtCnt }] = await Promise.all([
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club.id)
      .is("deleted_at", null),
    supabase
      .from("courts")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club.id)
      .is("deleted_at", null),
  ]);

  if ((memberCnt ?? 0) > 0 || (courtCnt ?? 0) > 0)
    return {
      ok: false,
      error: { message: "이미 데이터가 있어 샘플을 넣지 않았습니다." },
    };

  const { error: mErr } = await supabase
    .from("club_members")
    .insert(SAMPLE_MEMBERS.map((m) => ({ club_id: club.id, ...m })));
  if (mErr)
    return {
      ok: false,
      error: { message: "샘플 회원 생성에 실패했습니다.", detail: mErr.message },
    };

  const { error: cErr } = await supabase.from("courts").insert([
    { club_id: club.id, name: "1번 코트", sort_order: 1 },
    { club_id: club.id, name: "2번 코트", sort_order: 2 },
  ]);
  if (cErr)
    return {
      ok: false,
      error: { message: "샘플 코트 생성에 실패했습니다.", detail: cErr.message },
    };

  revalidateOperational();
  return {
    ok: true,
    data: { members: SAMPLE_MEMBERS.length, courts: 2 },
  };
}

// ---- 개발자 모드: 무작위 회원 생성 ----

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍",
];
const GIVEN = [
  "민준", "서연", "도윤", "하준", "지우", "서준", "예준", "주원", "지호", "지후",
  "준우", "건우", "현우", "민재", "우진", "유준", "서윤", "지민", "수아", "하은",
  "지윤", "채원", "지아", "수빈", "다은", "은우", "시우", "연우", "유나", "예린",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 개발자용: 무작위 회원 N명 생성(이름/성별/급수 랜덤). */
export async function seedRandomMembers(
  count: number,
): Promise<ActionResult<{ created: number }>> {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1 || n > 100)
    return { ok: false, error: { message: "1~100명 사이로 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const rows = Array.from({ length: n }, () => ({
    club_id: club.id,
    name: pick(SURNAMES) + pick(GIVEN),
    gender: (Math.random() < 0.5 ? "male" : "female") as MemberGender,
    level: 1 + Math.floor(Math.random() * 7),
  }));

  const supabase = await createClient();
  const { error } = await supabase.from("club_members").insert(rows);

  if (error)
    return {
      ok: false,
      error: { message: "회원 생성에 실패했습니다.", detail: error.message },
    };

  revalidateOperational();
  return { ok: true, data: { created: n } };
}
