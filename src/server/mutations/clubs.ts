"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";

/** 클럽 생성 (RPC: clubs + club_admins 트랜잭션). 생성 후 활성 클럽으로 설정. */
export async function createClub(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: { message: "클럽 이름을 입력하세요." } };

  const supabase = await createClient();

  // 익명(비회원) 사용자가 만든 클럽은 임시 클럽으로 표시한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAnonymous = user?.is_anonymous ?? false;

  const { data, error } = await supabase.rpc("create_club", {
    _name: name,
    _is_temporary: isAnonymous,
  });

  if (error) {
    return { ok: false, error: { message: "클럽 생성에 실패했습니다.", detail: error.message } };
  }

  const club = data as { id: string } | null;
  if (club?.id) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_CLUB_COOKIE, club.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** 활성 클럽 전환. */
export async function setActiveClub(clubId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLUB_COOKIE, clubId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 클럽 이름 변경. 클럽 멤버(관리자)면 가능(clubs update RLS). */
export async function renameClub(
  clubId: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: { message: "클럽 이름을 입력하세요." } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clubs")
    .update({ name: trimmed })
    .eq("id", clubId);
  if (error) {
    return { ok: false, error: { message: "이름 변경에 실패했습니다.", detail: error.message } };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 클럽 로고 URL 저장/제거. 클럽 멤버(관리자)면 가능(clubs update RLS).
 * 실제 이미지 업로드/삭제는 클라이언트에서 Storage(club-logos)로 처리하고,
 * 여기서는 공개 URL(또는 제거 시 null)만 DB에 반영한다.
 */
export async function updateClubLogo(
  clubId: string,
  logoUrl: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clubs")
    .update({ logo_url: logoUrl })
    .eq("id", clubId);
  if (error) {
    return { ok: false, error: { message: "로고 저장에 실패했습니다.", detail: error.message } };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 참여 코드 재생성(이전 코드 무효화). 클럽 admin만(RPC에서 검증). */
export async function regenerateJoinCode(
  clubId: string,
): Promise<ActionResult<{ code: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_join_code", {
    _club_id: clubId,
  });
  if (error || !data) {
    return { ok: false, error: { message: "코드 재생성에 실패했습니다.", detail: error?.message } };
  }
  revalidatePath(ROUTES.settings);
  return { ok: true, data: { code: data as string } };
}

/** 코드로 다른 클럽에 공동 관리자로 참여. 성공 시 해당 클럽을 활성으로 설정. */
export async function joinClubByCode(code: string): Promise<ActionResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: { message: "참여 코드를 입력하세요." } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_club_by_code", {
    _code: trimmed,
  });
  if (error || !data) {
    return {
      ok: false,
      error: { message: "참여에 실패했습니다. 코드를 확인하세요.", detail: error?.message },
    };
  }

  const club = data as { id: string } | null;
  if (club?.id) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_CLUB_COOKIE, club.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 공동 관리자 내보내기. owner만, owner 본인은 불가(RPC에서 검증). */
export async function removeClubAdmin(
  clubId: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_club_admin", {
    _club_id: clubId,
    _user_id: userId,
  });
  if (error) {
    return { ok: false, error: { message: "내보내기에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(ROUTES.settings);
  return { ok: true };
}

/** 클럽 삭제(soft delete). owner(super admin)만(RPC에서 검증). */
export async function deleteClub(clubId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_club", { _club_id: clubId });
  if (error) {
    return { ok: false, error: { message: "클럽 삭제에 실패했습니다.", detail: error.message } };
  }

  // 삭제된 클럽이 활성이었다면 쿠키 해제(다음 로드에서 다른 클럽/온보딩으로).
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_CLUB_COOKIE)?.value === clubId) {
    cookieStore.delete(ACTIVE_CLUB_COOKIE);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
