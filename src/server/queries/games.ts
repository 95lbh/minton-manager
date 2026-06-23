import { createClient } from "@/lib/supabase/server";
import { pairKey, type PlayerState, type PairHistory } from "@/server/services/assignment";
import type { Court, Game, MemberGender } from "@/types/db";

/** 코트 화면에 필요한 한 명의 표시 정보(출석 레코드 기준). */
export interface PoolPlayer extends PlayerState {
  isGuest: boolean;
  /** 대기자 상태: present(대기중) / lesson(레슨중) / left(집에감) */
  status: string;
}

/** 코트 화면에서 쓰는 진행 게임 요약(낙관적 stub도 이 필드만 채우면 됨). */
export interface OngoingGameInfo {
  id: string;
  court_id: string;
  status: Game["status"];
  started_at: string;
}

/** 진행 중인 게임 + 참가자(표시정보). */
export interface OngoingGameView {
  game: OngoingGameInfo;
  players: {
    attendanceRecordId: string;
    name: string;
    gender: MemberGender | null;
    level: number | null;
    team: number;
  }[];
}

/** 출석 레코드 한 행(회원 조인). */
interface AttRow {
  id: string;
  member_id: string | null;
  guest_name: string | null;
  guest_gender: MemberGender | null;
  guest_level: number | null;
  is_guest: boolean;
  checked_in_at: string;
  status: string;
  member: {
    id: string;
    name: string;
    gender: MemberGender | null;
    level: number | null;
  } | null;
}

function displayInfo(r: AttRow) {
  return {
    name: r.is_guest ? (r.guest_name ?? "게스트") : (r.member?.name ?? "회원"),
    gender: r.is_guest ? r.guest_gender : (r.member?.gender ?? null),
    level: r.is_guest ? r.guest_level : (r.member?.level ?? null),
  };
}

export interface CourtViewData {
  courts: Court[];
  ongoing: OngoingGameView[];
  pool: PoolPlayer[];
  /** 다음 게임 순번 (최신성 계산 기준) */
  currentSeq: number;
  /** 오늘 세션의 파트너/상대 이력 (자동 배정 추천용) */
  history: PairHistory;
}

/**
 * 코트 화면 데이터 일괄 로드.
 * - 오늘 세션의 모든 게임(진행/종료)으로 출석자별 gamesPlayed/lastPlayedSeq 계산
 * - 진행 중 게임에 속한 사람은 pool 에서 제외
 */
export async function getCourtViewData(
  clubId: string,
  sessionId: string,
): Promise<CourtViewData> {
  const supabase = await createClient();

  const [courtsRes, attRes, gamesRes, playersRes] = await Promise.all([
    supabase
      .from("courts")
      .select("*")
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("attendance_records")
      .select(
        "id, member_id, guest_name, guest_gender, guest_level, is_guest, checked_in_at, status, member:club_members(id, name, gender, level)",
      )
      .eq("session_id", sessionId)
      .order("checked_in_at", { ascending: true }),
    supabase
      .from("games")
      .select("id, court_id, session_id, status, started_at")
      .eq("session_id", sessionId)
      .order("started_at", { ascending: true }),
    // 오늘 세션의 게임에 속한 참가자만 조회(전체 클럽 이력 과다 조회 방지).
    // games!inner + games.session_id 필터로 세션 범위로 제한 → 게임이 쌓여도 비용 일정.
    supabase
      .from("game_players")
      .select("game_id, attendance_record_id, team, is_active, games!inner(session_id)")
      .eq("games.session_id", sessionId),
  ]);

  const courts = (courtsRes.data ?? []) as Court[];
  const attRows = (attRes.data ?? []) as unknown as AttRow[];
  const games = (gamesRes.data ?? []) as Game[];
  const players = (playersRes.data ?? []) as unknown as {
    game_id: string;
    attendance_record_id: string;
    team: number;
    is_active: boolean;
  }[];

  // 게임 순번(seq) 매핑: 오늘 게임을 started_at 순으로 1,2,3…
  const gameSeq = new Map<string, number>();
  games.forEach((g, i) => gameSeq.set(g.id, i + 1));
  const currentSeq = games.length + 1;

  // 출석자별 통계 계산
  const playersByGame = new Map<string, typeof players>();
  for (const p of players) {
    const arr = playersByGame.get(p.game_id);
    if (arr) arr.push(p);
    else playersByGame.set(p.game_id, [p]);
  }

  const gameById = new Map(games.map((g) => [g.id, g]));

  const gamesPlayed = new Map<string, number>();
  const lastSeq = new Map<string, number>();
  const lastEndedAt = new Map<string, number>(); // 마지막으로 끝난 게임 종료 시각(ms)
  const activeRecordIds = new Set<string>(); // 진행 중 게임에 속한 출석자

  for (const p of players) {
    const seq = gameSeq.get(p.game_id);
    if (seq == null) continue;
    gamesPlayed.set(
      p.attendance_record_id,
      (gamesPlayed.get(p.attendance_record_id) ?? 0) + 1,
    );
    const prev = lastSeq.get(p.attendance_record_id) ?? 0;
    if (seq > prev) lastSeq.set(p.attendance_record_id, seq);
    if (p.is_active) activeRecordIds.add(p.attendance_record_id);
    // 끝난 게임이면 종료 시각을 대기시작 후보로 기록
    const g = gameById.get(p.game_id);
    if (g && g.status !== "ongoing" && g.ended_at) {
      const t = new Date(g.ended_at).getTime();
      const prevEnd = lastEndedAt.get(p.attendance_record_id) ?? 0;
      if (t > prevEnd) lastEndedAt.set(p.attendance_record_id, t);
    }
  }

  // 진행 중 게임 뷰
  const ongoingGames = games.filter((g) => g.status === "ongoing");
  const attById = new Map(attRows.map((r) => [r.id, r]));
  const ongoing: OngoingGameView[] = ongoingGames.map((g) => {
    const gps = (playersByGame.get(g.id) ?? []).slice().sort((a, b) => a.team - b.team);
    return {
      game: g,
      players: gps.map((gp) => {
        const r = attById.get(gp.attendance_record_id);
        const info = r
          ? displayInfo(r)
          : { name: "?", gender: null, level: null };
        return {
          attendanceRecordId: gp.attendance_record_id,
          name: info.name,
          gender: info.gender,
          level: info.level,
          team: gp.team,
        };
      }),
    };
  });

  // 파트너/상대 이력 (오늘 세션 전체 게임 기준)
  const history: PairHistory = {
    partnerCount: {},
    opponentCount: {},
    lastPartnerSeq: {},
    lastOpponentSeq: {},
  };
  for (const [gameId, gps] of playersByGame) {
    const seq = gameSeq.get(gameId);
    if (seq == null) continue;
    for (let i = 0; i < gps.length; i++) {
      for (let j = i + 1; j < gps.length; j++) {
        const a = gps[i].attendance_record_id;
        const b = gps[j].attendance_record_id;
        const key = pairKey(a, b);
        if (gps[i].team === gps[j].team) {
          history.partnerCount[key] = (history.partnerCount[key] ?? 0) + 1;
          history.lastPartnerSeq![key] = Math.max(history.lastPartnerSeq![key] ?? 0, seq);
        } else {
          history.opponentCount[key] = (history.opponentCount[key] ?? 0) + 1;
          history.lastOpponentSeq![key] = Math.max(history.lastOpponentSeq![key] ?? 0, seq);
        }
      }
    }
  }

  // 대기자 풀: 진행 중 게임에 없는 출석자
  const pool: PoolPlayer[] = attRows
    .filter((r) => !activeRecordIds.has(r.id))
    .map((r) => {
      const info = displayInfo(r);
      // 대기 시작 = max(체크인 시각, 마지막 게임 종료 시각)
      const checkedIn = new Date(r.checked_in_at).getTime();
      const ended = lastEndedAt.get(r.id) ?? 0;
      return {
        id: r.id,
        name: info.name,
        gender: info.gender,
        skill: info.level,
        gamesPlayed: gamesPlayed.get(r.id) ?? 0,
        lastPlayedSeq: lastSeq.get(r.id) ?? null,
        waitingSince: Math.max(checkedIn, ended),
        isGuest: r.is_guest,
        status: r.status,
      };
    });

  return { courts, ongoing, pool, currentSeq, history };
}
