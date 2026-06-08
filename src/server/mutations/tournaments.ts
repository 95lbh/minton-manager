"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import type { ActionResult } from "@/server/types";
import { splitTeams, DEFAULT_LEVEL } from "@/server/services/team-split";
import { scheduleTeamGames } from "@/server/services/team-schedule";
import { makePairs, roundRobin } from "@/server/services/league";
import { seedPairs } from "@/server/services/bracket";
import { getMatches } from "@/server/queries/tournaments";
import type {
  MemberGender,
  TournamentMatchType,
  TournamentStatus,
  TournamentStructure,
  TournamentTeam,
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

/**
 * 리그전 대진 생성(round-robin). 단식=개인, 복식=실력 균형 페어.
 * 사이드 A=blue, 사이드 B=white로 저장(재사용). 기존 게임은 삭제 후 재생성.
 */
export async function generateLeague(
  tournamentId: string,
): Promise<ActionResult<{ excluded: number; excludedNames: string[] }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tournaments")
    .select("match_type")
    .eq("id", tournamentId)
    .maybeSingle();
  const isDoubles = (t?.match_type as string) !== "singles";

  const { data: parts, error: pErr } = await supabase
    .from("tournament_participants")
    .select("id, name, level")
    .eq("tournament_id", tournamentId);
  if (pErr || !parts) {
    return { ok: false, error: { message: "참가자를 불러오지 못했습니다.", detail: pErr?.message } };
  }

  const nameOf = new Map(parts.map((p) => [p.id as string, p.name as string]));

  // 유닛 구성: 단식=개인 1명, 복식=페어 2명
  let units: string[][];
  let excludedNames: string[] = [];
  if (isDoubles) {
    const { pairs, unpaired } = makePairs(
      parts.map((p) => ({ id: p.id as string, level: p.level as number | null })),
    );
    units = pairs.map((pr) => [...pr]);
    excludedNames = unpaired.map((id) => nameOf.get(id) ?? "참가자");
  } else {
    units = parts.map((p) => [p.id as string]);
  }

  if (units.length < 2) {
    return { ok: false, error: { message: "리그를 만들려면 2팀(명) 이상이어야 합니다." } };
  }

  const rr = roundRobin(units.length);

  await supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId);

  const { data: inserted, error: mErr } = await supabase
    .from("tournament_matches")
    .insert(rr.map((_, i) => ({ club_id: club.id, tournament_id: tournamentId, order_no: i + 1 })))
    .select("id, order_no");
  if (mErr || !inserted) {
    return { ok: false, error: { message: "대진 생성에 실패했습니다.", detail: mErr?.message } };
  }
  const ordered = [...inserted].sort((a, b) => (a.order_no as number) - (b.order_no as number));

  const sides: {
    club_id: string;
    match_id: string;
    team: TournamentTeam;
    participant_id: string;
  }[] = [];
  rr.forEach(([i, j], idx) => {
    const matchId = ordered[idx].id as string;
    units[i].forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "blue", participant_id: pid }));
    units[j].forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "white", participant_id: pid }));
  });

  const { error: sErr } = await supabase.from("tournament_match_sides").insert(sides);
  if (sErr) {
    return { ok: false, error: { message: "대진 저장에 실패했습니다.", detail: sErr.message } };
  }

  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true, data: { excluded: excludedNames.length, excludedNames } };
}

/**
 * 토너먼트 1라운드 대진 생성(싱글 엘리미네이션, 시드 배치).
 * 단식=개인, 복식=실력 균형 페어. 부전승은 한쪽만 채운 경기로 저장. 기존 게임 삭제 후 생성.
 */
export async function generateTournamentRound1(
  tournamentId: string,
  seeding: "skill" | "random" | "manual" = "skill",
): Promise<ActionResult<{ excluded: number; excludedNames: string[] }>> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tournaments")
    .select("match_type")
    .eq("id", tournamentId)
    .maybeSingle();
  const isDoubles = (t?.match_type as string) !== "singles";

  const { data: parts, error: pErr } = await supabase
    .from("tournament_participants")
    .select("id, name, level, seed")
    .eq("tournament_id", tournamentId);
  if (pErr || !parts) {
    return { ok: false, error: { message: "참가자를 불러오지 못했습니다.", detail: pErr?.message } };
  }

  const nameOf = new Map(parts.map((p) => [p.id as string, p.name as string]));
  const levelOf = new Map(parts.map((p) => [p.id as string, (p.level as number | null) ?? DEFAULT_LEVEL]));
  const seedOf = new Map(parts.map((p) => [p.id as string, p.seed as number | null]));
  // 수동 시드값(없으면 Infinity → 뒤로). 유닛 시드 = 멤버 시드 합.
  const unitSeed = (ids: string[]) =>
    ids.reduce((s, id) => s + (seedOf.get(id) ?? Number.MAX_SAFE_INTEGER), 0);

  let units: { ids: string[]; skill: number }[];
  let excludedNames: string[] = [];
  if (isDoubles) {
    const { pairs, unpaired } = makePairs(
      parts.map((p) => ({ id: p.id as string, level: p.level as number | null })),
    );
    units = pairs.map(([a, b]) => ({ ids: [a, b], skill: levelOf.get(a)! + levelOf.get(b)! }));
    excludedNames = unpaired.map((id) => nameOf.get(id) ?? "참가자");
  } else {
    units = parts.map((p) => ({ ids: [p.id as string], skill: levelOf.get(p.id as string)! }));
  }

  if (units.length < 2) {
    return { ok: false, error: { message: "토너먼트는 2팀(명) 이상이어야 합니다." } };
  }

  // 배치 방식: manual=시드 순(시드 편집기), random=무작위, skill=실력 순(기본)
  if (seeding === "manual") {
    units.sort((a, b) => unitSeed(a.ids) - unitSeed(b.ids) || b.skill - a.skill || (a.ids[0] < b.ids[0] ? -1 : 1));
  } else if (seeding === "random") {
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
  } else {
    units.sort((a, b) => b.skill - a.skill || (a.ids[0] < b.ids[0] ? -1 : 1));
  }
  const pairs = seedPairs(units.length);

  await supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId);

  const { data: inserted, error: mErr } = await supabase
    .from("tournament_matches")
    .insert(pairs.map((_, i) => ({ club_id: club.id, tournament_id: tournamentId, round: 1, order_no: i + 1 })))
    .select("id, order_no");
  if (mErr || !inserted) {
    return { ok: false, error: { message: "대진 생성에 실패했습니다.", detail: mErr?.message } };
  }
  const ordered = [...inserted].sort((a, b) => (a.order_no as number) - (b.order_no as number));

  const sides: { club_id: string; match_id: string; team: TournamentTeam; participant_id: string }[] = [];
  pairs.forEach((pr, idx) => {
    const matchId = ordered[idx].id as string;
    if (pr.a != null) units[pr.a - 1].ids.forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "blue", participant_id: pid }));
    if (pr.b != null) units[pr.b - 1].ids.forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "white", participant_id: pid }));
  });

  const { error: sErr } = await supabase.from("tournament_match_sides").insert(sides);
  if (sErr) {
    return { ok: false, error: { message: "대진 저장에 실패했습니다.", detail: sErr.message } };
  }

  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true, data: { excluded: excludedNames.length, excludedNames } };
}

/** 토너먼트 다음 라운드 생성: 현재 마지막 라운드 승자끼리 대진. */
export async function generateNextRound(
  tournamentId: string,
): Promise<ActionResult> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const all = await getMatches(tournamentId);
  const rounds = all.map((m) => m.round ?? 0);
  const maxRound = Math.max(...rounds);
  if (!Number.isFinite(maxRound) || maxRound < 1) {
    return { ok: false, error: { message: "먼저 1라운드 대진을 생성하세요." } };
  }
  const roundMatches = all
    .filter((m) => (m.round ?? 0) === maxRound)
    .sort((a, b) => a.order_no - b.order_no);

  if (roundMatches.length <= 1) {
    return { ok: false, error: { message: "이미 우승자가 결정되었습니다." } };
  }

  // 승자 산출
  const winners: string[][] = [];
  for (const m of roundMatches) {
    const blueIds = m.blue.map((p) => p.id);
    const whiteIds = m.white.map((p) => p.id);
    if (whiteIds.length === 0) {
      winners.push(blueIds);
    } else if (blueIds.length === 0) {
      winners.push(whiteIds);
    } else if (m.scoreBlue == null || m.scoreWhite == null) {
      return { ok: false, error: { message: "이번 라운드 결과를 모두 입력하세요." } };
    } else if (m.scoreBlue === m.scoreWhite) {
      return { ok: false, error: { message: "무승부가 있어요. 점수를 조정하세요." } };
    } else {
      winners.push(m.scoreBlue > m.scoreWhite ? blueIds : whiteIds);
    }
  }

  const supabase = await createClient();
  const nextRound = maxRound + 1;
  const pairCount = Math.floor(winners.length / 2);

  const { data: inserted, error: mErr } = await supabase
    .from("tournament_matches")
    .insert(
      Array.from({ length: pairCount }, (_, i) => ({
        club_id: club.id,
        tournament_id: tournamentId,
        round: nextRound,
        order_no: i + 1,
      })),
    )
    .select("id, order_no");
  if (mErr || !inserted) {
    return { ok: false, error: { message: "다음 라운드 생성에 실패했습니다.", detail: mErr?.message } };
  }
  const ordered = [...inserted].sort((a, b) => (a.order_no as number) - (b.order_no as number));

  const sides: { club_id: string; match_id: string; team: TournamentTeam; participant_id: string }[] = [];
  for (let k = 0; k < pairCount; k++) {
    const matchId = ordered[k].id as string;
    winners[2 * k].forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "blue", participant_id: pid }));
    winners[2 * k + 1].forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "white", participant_id: pid }));
  }

  const { error: sErr } = await supabase.from("tournament_match_sides").insert(sides);
  if (sErr) {
    return { ok: false, error: { message: "다음 라운드 저장에 실패했습니다.", detail: sErr.message } };
  }

  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}

/** 게임 결과(청/백 점수) 저장. match_id 기준 upsert. */
export async function setMatchResult(
  matchId: string,
  tournamentId: string,
  scoreBlue: number,
  scoreWhite: number,
): Promise<ActionResult> {
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const sb = Math.max(0, Math.floor(scoreBlue));
  const sw = Math.max(0, Math.floor(scoreWhite));

  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_results")
    .upsert(
      { club_id: club.id, match_id: matchId, score_blue: sb, score_white: sw },
      { onConflict: "match_id" },
    );

  if (error) {
    return { ok: false, error: { message: "결과 저장에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}

/** 대회 진행 상태 변경: 준비중(draft) / 진행중(ongoing) / 종료(finished). */
export async function setTournamentStatus(
  id: string,
  status: TournamentStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { ok: false, error: { message: "상태 변경에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${id}`);
  revalidatePath(ROUTES.tournaments);
  return { ok: true };
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
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
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
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}

/** 청팀/백팀 자동 균형 편성. 성비·실력을 고르게 분배해 team 갱신. */
export async function autoSplitTeams(tournamentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("id, gender, level")
    .eq("tournament_id", tournamentId);

  if (error || !data) {
    return { ok: false, error: { message: "참가자를 불러오지 못했습니다.", detail: error?.message } };
  }
  if (data.length < 2) {
    return { ok: false, error: { message: "참가자가 2명 이상이어야 편성할 수 있습니다." } };
  }

  const result = splitTeams(
    data.map((p) => ({
      id: p.id as string,
      gender: p.gender as "male" | "female" | "other" | null,
      level: p.level as number | null,
    })),
  );

  // 팀별로 한 번에 갱신(2 쿼리).
  if (result.blue.length) {
    const { error: e1 } = await supabase
      .from("tournament_participants")
      .update({ team: "blue" })
      .in("id", result.blue);
    if (e1) return { ok: false, error: { message: "팀 배정에 실패했습니다.", detail: e1.message } };
  }
  if (result.white.length) {
    const { error: e2 } = await supabase
      .from("tournament_participants")
      .update({ team: "white" })
      .in("id", result.white);
    if (e2) return { ok: false, error: { message: "팀 배정에 실패했습니다.", detail: e2.message } };
  }

  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}

/**
 * 청팀/백팀 게임 자동 편성. 인당 보장 게임수(설정 저장) + 실력 매칭.
 * 기존 게임은 모두 삭제 후 새로 생성.
 */
export async function generateTeamGames(
  tournamentId: string,
  gamesPerPlayer: number,
): Promise<ActionResult<{ excluded: number; excludedNames: string[] }>> {
  const n = Math.max(1, Math.floor(gamesPerPlayer));
  const club = await getActiveClub();
  if (!club) return { ok: false, error: { message: "클럽을 먼저 선택하세요." } };

  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tournaments")
    .select("match_type")
    .eq("id", tournamentId)
    .maybeSingle();
  const perSide: 1 | 2 = (t?.match_type as string) === "singles" ? 1 : 2;

  const { data: parts, error: pErr } = await supabase
    .from("tournament_participants")
    .select("id, name, gender, level, team")
    .eq("tournament_id", tournamentId);
  if (pErr || !parts) {
    return { ok: false, error: { message: "참가자를 불러오지 못했습니다.", detail: pErr?.message } };
  }

  // 팀에 속하지만 성별이 남/여가 아니라 편성 불가한 인원(제외 대상).
  const excludedNames = parts
    .filter(
      (p) =>
        (p.team === "blue" || p.team === "white") &&
        p.gender !== "male" &&
        p.gender !== "female",
    )
    .map((p) => p.name as string);

  const toSched = (p: (typeof parts)[number]) => ({
    id: p.id as string,
    gender: p.gender as "male" | "female" | "other" | null,
    level: p.level as number | null,
  });
  const blue = parts.filter((p) => p.team === "blue").map(toSched);
  const white = parts.filter((p) => p.team === "white").map(toSched);

  const { games, reason } = scheduleTeamGames({ blue, white, perSide, gamesPerPlayer: n });
  if (reason) return { ok: false, error: { message: reason } };
  if (games.length === 0) {
    return { ok: false, error: { message: "편성할 게임이 없습니다. 팀 배정을 확인하세요." } };
  }

  // 설정값 저장
  await supabase.from("tournaments").update({ games_per_player: n }).eq("id", tournamentId);

  // 기존 게임 삭제(사이드는 cascade)
  await supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId);

  // 게임 insert → id 확보
  const { data: inserted, error: mErr } = await supabase
    .from("tournament_matches")
    .insert(games.map((_, i) => ({ club_id: club.id, tournament_id: tournamentId, order_no: i + 1 })))
    .select("id, order_no");
  if (mErr || !inserted) {
    return { ok: false, error: { message: "게임 생성에 실패했습니다.", detail: mErr?.message } };
  }

  const ordered = [...inserted].sort((a, b) => (a.order_no as number) - (b.order_no as number));
  const sides: {
    club_id: string;
    match_id: string;
    team: TournamentTeam;
    participant_id: string;
  }[] = [];
  games.forEach((game, i) => {
    const matchId = ordered[i].id as string;
    game.blue.forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "blue", participant_id: pid }));
    game.white.forEach((pid) => sides.push({ club_id: club.id, match_id: matchId, team: "white", participant_id: pid }));
  });

  const { error: sErr } = await supabase.from("tournament_match_sides").insert(sides);
  if (sErr) {
    return { ok: false, error: { message: "대진 저장에 실패했습니다.", detail: sErr.message } };
  }

  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true, data: { excluded: excludedNames.length, excludedNames } };
}

/** 참가자 팀 수동 지정/해제(blue/white/null). */
export async function setParticipantTeam(
  participantId: string,
  tournamentId: string,
  team: TournamentTeam | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_participants")
    .update({ team })
    .eq("id", participantId);

  if (error) {
    return { ok: false, error: { message: "팀 변경에 실패했습니다.", detail: error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}

/** 토너먼트 시드 순서 저장. orderedIds 순서대로 seed=1,2,3… 부여. */
export async function setSeedOrder(
  tournamentId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("tournament_participants").update({ seed: i + 1 }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: { message: "시드 저장에 실패했습니다.", detail: failed.error.message } };
  }
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
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
  revalidatePath(`${ROUTES.tournaments}/${tournamentId}`, "layout");
  return { ok: true };
}
