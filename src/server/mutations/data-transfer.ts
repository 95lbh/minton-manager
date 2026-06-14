"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub, isActiveClubOwner } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";
import type { MemberGender } from "@/types/db";
import {
  MEMBER_BUNDLE_VERSION,
  type ImportMode,
  type MemberBundle,
  type MemberExportRow,
} from "./data-transfer-format";

const MAX_IMPORT = 2000;
const VALID_GENDERS: MemberGender[] = ["male", "female", "other"];

/** 파일명에 쓸 수 없는 문자를 정리. */
function safeFileSegment(s: string): string {
  return (s || "club").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 40) || "club";
}

function yyyymmdd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * 활성 클럽의 회원 목록을 백업 번들로 반환한다.
 * 파일 다운로드는 클라이언트에서 Blob 으로 처리(서버는 데이터만 제공).
 */
export async function exportMembers(): Promise<
  ActionResult<{ bundle: MemberBundle; fileName: string }>
> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const members = await getMembers(club.id);
  const now = new Date();
  const bundle: MemberBundle = {
    app: "myminton",
    type: "members",
    version: MEMBER_BUNDLE_VERSION,
    exportedAt: now.toISOString(),
    club: { name: club.name },
    members: members.map((m) => ({
      name: m.name,
      gender: m.gender,
      level: m.level,
      birthYear: m.birth_year,
      phone: m.phone,
    })),
  };

  const fileName = `myminton_${safeFileSegment(club.name)}_members_${yyyymmdd(now)}.json`;
  return { ok: true, data: { bundle, fileName } };
}

/** 외부에서 들어온 임의 입력을 안전한 회원 행으로 정규화(잘못된 값은 버리거나 null 처리). */
function normalizeRows(input: unknown): MemberExportRow[] {
  if (!Array.isArray(input)) return [];
  const rows: MemberExportRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue; // 이름 없으면 건너뜀

    const gender =
      typeof r.gender === "string" && VALID_GENDERS.includes(r.gender as MemberGender)
        ? (r.gender as MemberGender)
        : null;

    let level: number | null = null;
    const lv = typeof r.level === "number" ? r.level : Number(r.level);
    if (Number.isFinite(lv) && lv >= 1 && lv <= 7) level = Math.floor(lv);

    let birthYear: number | null = null;
    const by = typeof r.birthYear === "number" ? r.birthYear : Number(r.birthYear);
    if (Number.isFinite(by) && by >= 1900 && by <= 2100) birthYear = Math.floor(by);

    const phone =
      typeof r.phone === "string" && r.phone.trim() ? r.phone.trim().slice(0, 50) : null;

    rows.push({ name: name.slice(0, 100), gender, level, birthYear, phone });
  }
  return rows;
}

/**
 * 백업된 회원 목록을 활성 클럽으로 불러온다.
 * - overwrite: 기존 활성 회원을 모두 soft delete 후 전체 삽입(과거 기록은 보존).
 * - merge: 기존 활성 회원과 이름이 같은 행은 건너뛰고 나머지만 삽입.
 */
export async function importMembers(
  rawMembers: unknown,
  mode: ImportMode,
): Promise<ActionResult<{ imported: number; skipped: number; removed: number }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  if (mode !== "overwrite" && mode !== "merge")
    return { ok: false, error: { message: "올바르지 않은 불러오기 방식입니다." } };

  // 덮어쓰기는 기존 회원을 모두 비우는 파괴적 작업 → 소유자만 허용. (병합은 추가형이라 허용)
  if (mode === "overwrite" && !(await isActiveClubOwner()))
    return {
      ok: false,
      error: { message: "덮어쓰기는 클럽 소유자만 할 수 있습니다. 병합을 사용하세요." },
    };

  let rows = normalizeRows(rawMembers);
  if (rows.length === 0)
    return { ok: false, error: { message: "불러올 회원 정보가 없습니다. 파일을 확인하세요." } };
  if (rows.length > MAX_IMPORT)
    return {
      ok: false,
      error: { message: `한 번에 ${MAX_IMPORT}명까지만 불러올 수 있습니다.` },
    };

  const supabase = await createClient();
  let removed = 0;
  let skipped = 0;

  if (mode === "overwrite") {
    // 기존 활성 회원 전체 soft delete (FK 보존을 위해 hard delete 하지 않음 — 과거 기록 유지)
    const { data: del, error: delErr } = await supabase
      .from("club_members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("club_id", club.id)
      .is("deleted_at", null)
      .select("id");
    if (delErr)
      return {
        ok: false,
        error: { message: "기존 회원 정리에 실패했습니다.", detail: delErr.message },
      };
    removed = del?.length ?? 0;
  } else {
    // merge: 기존 활성 회원 이름과 중복되는 행 제거
    const existing = await getMembers(club.id);
    const seen = new Set(existing.map((m) => m.name.trim().toLowerCase()));
    const before = rows.length;
    const deduped: MemberExportRow[] = [];
    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); // 파일 내부 중복도 제거
      deduped.push(r);
    }
    rows = deduped;
    skipped = before - rows.length;
    if (rows.length === 0)
      return { ok: true, data: { imported: 0, skipped, removed: 0 } };
  }

  const { data: ins, error: insErr } = await supabase
    .from("club_members")
    .insert(
      rows.map((r) => ({
        club_id: club.id,
        name: r.name,
        gender: r.gender,
        level: r.level,
        birth_year: r.birthYear,
        phone: r.phone,
      })),
    )
    .select("id");

  if (insErr)
    return {
      ok: false,
      error: { message: "회원 불러오기에 실패했습니다.", detail: insErr.message },
    };

  revalidatePath(ROUTES.members);
  revalidatePath(ROUTES.stats);
  revalidatePath(ROUTES.dashboard);

  return { ok: true, data: { imported: ins?.length ?? 0, skipped, removed } };
}
