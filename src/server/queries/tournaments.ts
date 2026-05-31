import { createClient } from "@/lib/supabase/server";
import type { Tournament, TournamentParticipant } from "@/types/db";

/** 클럽의 대회 목록(삭제 제외, 최신순). */
export async function getTournaments(clubId: string): Promise<Tournament[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("club_id", clubId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Tournament[];
}

/** 단일 대회(삭제 제외). 없으면 null. */
export async function getTournament(id: string): Promise<Tournament | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tournament;
}

/** 대회 참가자 목록(등록 순). */
export async function getParticipants(
  tournamentId: string,
): Promise<TournamentParticipant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as TournamentParticipant[];
}
