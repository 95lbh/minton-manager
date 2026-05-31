"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";
import type {
  MemberGender,
  TournamentMatchType,
  TournamentStructure,
} from "@/types/db";

/** 대회 생성. 생성한 대회 id 반환. */
export async function createTournament(
  name: string,
  matchType: TournamentMatchType,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: { message: "대회 이름을 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert({ club_id: club.id, name: trimmed, match_type: matchType })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: { message: "대회 생성에 실패했습니다.", detail: error?.message } };
  }

  revalidatePath(ROUTES.tournaments);
  return { ok: true, data: { id: data.id as string } };
}

/** 대회 형식(구조) 설정: 토너먼트 / 리그전 / 청팀백팀. */
export async function setTournamentStructure(
  id: string,
  structure: TournamentStructure,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ structure })
    .eq("id", id);

  if (error) {
    return { ok: false, error: { message: "형식 설정에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${id}`);
  return { ok: true };
}

/** 대회 삭제(soft delete). */
export async function deleteTournament(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false, error: { message: "대회 삭제에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(ROUTES.tournaments);
  return { ok: true };
}

/** 회원들을 참가자로 일괄 등록. 이미 등록된 회원은 무시(unique 제약). */
export async function addParticipantsFromMembers(
  tournamentId: string,
  members: {
    id: string;
    name: string;
    gender: MemberGender | null;
    level: number | null;
  }[],
): Promise<ActionResult> {
  if (members.length === 0) return { ok: true };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  // 이미 등록된 회원 제외(부분 unique 인덱스라 upsert onConflict 대신 사전 필터).
  const { data: existing } = await supabase
    .from("tournament_participants")
    .select("member_id")
    .eq("tournament_id", tournamentId)
    .not("member_id", "is", null);
  const existingIds = new Set((existing ?? []).map((r) => r.member_id as string));

  const rows = members
    .filter((m) => !existingIds.has(m.id))
    .map((m) => ({
      club_id: club.id,
      tournament_id: tournamentId,
      member_id: m.id,
      name: m.name,
      gender: m.gender,
      level: m.level,
    }));

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase.from("tournament_participants").insert(rows);

  if (error) {
    return { ok: false, error: { message: "참가자 등록에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`);
  return { ok: true };
}

/** 신규(비회원) 참가자 등록. 성별/급수 선택. */
export async function addGuestParticipant(
  tournamentId: string,
  participant: { name: string; gender: MemberGender | null; level: number | null },
): Promise<ActionResult> {
  const trimmed = participant.name.trim();
  if (!trimmed) return { ok: false, error: { message: "참가자 이름을 입력하세요." } };

  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();
  const { error } = await supabase.from("tournament_participants").insert({
    club_id: club.id,
    tournament_id: tournamentId,
    name: trimmed,
    gender: participant.gender,
    level: participant.level,
  });

  if (error) {
    return { ok: false, error: { message: "참가자 등록에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`);
  return { ok: true };
}

/** 참가자 제거. */
export async function removeParticipant(
  participantId: string,
  tournamentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_participants")
    .delete()
    .eq("id", participantId);

  if (error) {
    return { ok: false, error: { message: "참가자 제거에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`);
  return { ok: true };
}
