/**
 * DB 엔티티 타입 (수기 작성, MVP 1단계).
 * Supabase 프로젝트 연결 후 `supabase gen types typescript` 로 자동 생성 타입으로 교체 예정.
 * 스키마 원본: supabase/migrations/0001_init.sql
 */
import type { ClubRole } from "@/lib/constants";

export type MemberGender = "male" | "female" | "other";
export type GameStatus = "ongoing" | "finished" | "canceled";
export type SessionStatus = "open" | "closed";
export type TournamentStatus = "draft" | "ongoing" | "finished";
export type TournamentMatchType = "singles" | "doubles";
export type TournamentStructure = "tournament" | "league" | "team_split";
export type TournamentTeam = "blue" | "white";

export interface Club {
  id: string;
  name: string;
  owner_id: string;
  is_temporary: boolean;
  join_code: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClubAdmin {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  created_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  name: string;
  gender: MemberGender | null;
  level: number | null;
  phone: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Court {
  id: string;
  club_id: string;
  name: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AttendanceSession {
  id: string;
  club_id: string;
  session_date: string;
  name: string | null;
  status: SessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  club_id: string;
  member_id: string | null;
  guest_name: string | null;
  guest_gender: MemberGender | null;
  guest_level: number | null;
  is_guest: boolean;
  checked_in_at: string;
  status: string;
}

export interface Game {
  id: string;
  club_id: string;
  session_id: string;
  court_id: string;
  status: GameStatus;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  club_id: string;
  attendance_record_id: string;
  team: number;
  is_active: boolean;
}

export interface MemberStats {
  member_id: string;
  club_id: string;
  attend_cnt: number;
  game_cnt: number;
  last_played_at: string | null;
}

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  match_type: TournamentMatchType;
  structure: TournamentStructure | null;
  games_per_player: number;
  status: TournamentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TournamentMatch {
  id: string;
  club_id: string;
  tournament_id: string;
  order_no: number;
  status: string;
  created_at: string;
}

export interface TournamentMatchSide {
  id: string;
  club_id: string;
  match_id: string;
  team: TournamentTeam;
  participant_id: string;
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  club_id: string;
  tournament_id: string;
  member_id: string | null;
  name: string;
  gender: MemberGender | null;
  level: number | null;
  team: TournamentTeam | null;
  seed: number | null;
  created_at: string;
}
