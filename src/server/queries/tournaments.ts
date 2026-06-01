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

export interface MatchView {
  id: string;
  order_no: number;
  round: number | null;
  status: string;
  blue: { id: string; name: string }[];
  white: { id: string; name: string }[];
  scoreBlue: number | null;
  scoreWhite: number | null;
}

interface RawSide {
  team: "blue" | "white";
  participant: { id: string; name: string } | null;
}

/** 대회 게임 목록(양 팀 참가자 + 결과 점수 조인, 순서대로). */
export async function getMatches(tournamentId: string): Promise<MatchView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(
      "id, order_no, round, status, sides:tournament_match_sides(team, participant:tournament_participants(id, name)), result:tournament_results(score_blue, score_white)",
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true, nullsFirst: true })
    .order("order_no", { ascending: true });

  if (error || !data) return [];

  type RawResult = { score_blue: number; score_white: number };
  return (
    data as unknown as {
      id: string;
      order_no: number;
      round: number | null;
      status: string;
      sides: RawSide[];
      // match_id가 unique라 PostgREST가 1:1로 보고 객체(또는 null)로 반환할 수 있음.
      result: RawResult | RawResult[] | null;
    }[]
  ).map((m) => {
    const blue = m.sides.filter((s) => s.team === "blue" && s.participant).map((s) => s.participant!);
    const white = m.sides.filter((s) => s.team === "white" && s.participant).map((s) => s.participant!);
    const r = Array.isArray(m.result) ? m.result[0] : m.result;
    return {
      id: m.id,
      order_no: m.order_no,
      round: m.round,
      status: m.status,
      blue,
      white,
      scoreBlue: r ? r.score_blue : null,
      scoreWhite: r ? r.score_white : null,
    };
  });
}
