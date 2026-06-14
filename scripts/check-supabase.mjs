// Supabase 연동 + 마이그레이션 적용 점검 (비밀값 출력 안 함)
// 실행: node --env-file=.env.local scripts/check-supabase.mjs
//   또는 npm run check:db
//
// 목적: "마이그레이션을 깜빡 적용 안 해 기능이 조용히 안 되는" 사고 방지.
//   - 기대하는 테이블/컬럼/RPC/스토리지 버킷이 실제 DB에 있는지 확인.
//   - 하나라도 없으면 종료코드 1 → 배포 게이트(CI)로도 사용 가능.
// 안전성: 모든 검사는 읽기 전용 probe. RPC는 더미/무효 인자로 호출돼
//   권한·검증 단계에서 막히므로 데이터를 변경하지 않는다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ .env.local 의 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 비어 있습니다.");
  process.exit(1);
}
console.log("✓ 환경변수 로드됨 (URL 호스트:", new URL(url).host + ")\n");

const sb = createClient(url, key);
const NIL = "00000000-0000-0000-0000-000000000000";

let failed = 0;
const pass = (msg) => console.log("  ✅", msg);
const fail = (msg) => {
  failed++;
  console.log("  ❌", msg);
};
const warn = (msg) => console.log("  ⚠️ ", msg);

/** 테이블 존재 여부. RLS로 0행이어도 에러 없음 → 존재. 미존재면 42P01/PGRST205. */
async function tableExists(t) {
  const { error } = await sb.from(t).select("*", { head: true, count: "exact" });
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  return true; // 그 외(RLS 등)는 존재로 간주
}

/** 컬럼 존재 여부. 미존재면 42703(undefined_column). */
async function columnExists(t, c) {
  const { error } = await sb.from(t).select(c, { head: true });
  if (!error) return true;
  if (error.code === "42703" || /column .* does not exist/i.test(error.message))
    return false;
  if (error.code === "42P01" || error.code === "PGRST205") return false; // 테이블 자체 없음
  return true;
}

/** RPC(함수) 존재 여부. 미존재면 PGRST202. (권한/검증 에러는 존재를 의미) */
async function rpcExists(name, args) {
  const { error } = await sb.rpc(name, args);
  return !(error && error.code === "PGRST202");
}

// ── 1) Auth 설정 ────────────────────────────────────────────────
const mark = (on) => (on ? "활성화됨 ✅" : "비활성화 ❌");
console.log("[Auth]");
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  const s = await res.json();
  console.log("  · Google 로그인:", mark(s?.external?.google));
  console.log("  · Kakao 로그인:", mark(s?.external?.kakao));
  console.log("  · 익명(비회원) 로그인:", mark(s?.external?.anonymous_users));
} catch (e) {
  console.log("  ❌ Auth 설정 조회 실패:", e.message);
}

// ── 2) 핵심 스키마 (0001) ───────────────────────────────────────
console.log("\n[0001 기본 스키마]");
for (const t of [
  "clubs",
  "club_members",
  "courts",
  "attendance_sessions",
  "attendance_records",
  "games",
  "game_players",
]) {
  (await tableExists(t)) ? pass(t) : fail(`${t} 없음 — 0001_init.sql 실행 필요`);
}

// ── 3) 마이그레이션별 핵심 객체 ─────────────────────────────────
console.log("\n[마이그레이션 적용 여부]");

// 0002: create_club RPC
(await rpcExists("create_club", { _name: "" }))
  ? pass("0002 create_club RPC")
  : fail("0002 create_club RPC 없음 — 0002_create_club_rpc.sql");

// 0003: 게스트 성별/실력 컬럼
(await columnExists("attendance_records", "guest_gender"))
  ? pass("0003 attendance_records.guest_gender")
  : fail("0003 게스트 컬럼 없음 — 0003_attendance_guest_and_grade.sql");

// 0006: 공유 코드 + 참여 RPC
(await columnExists("clubs", "join_code"))
  ? pass("0006 clubs.join_code")
  : fail("0006 clubs.join_code 없음 — 0006_club_sharing.sql");
(await rpcExists("join_club_by_code", { _code: NIL }))
  ? pass("0006 join_club_by_code RPC")
  : fail("0006 join_club_by_code RPC 없음 — 0006_club_sharing.sql");

// 0007: 관리자 관리 RPC
(await rpcExists("list_club_admins", { _club_id: NIL }))
  ? pass("0007 list_club_admins RPC")
  : fail("0007 list_club_admins RPC 없음 — 0007_club_admin_guard.sql");
(await rpcExists("remove_club_admin", { _club_id: NIL, _user_id: NIL }))
  ? pass("0007 remove_club_admin RPC")
  : fail("0007 remove_club_admin RPC 없음 — 0007_club_admin_guard.sql");

// 0008/0011/0012: 대회 테이블
(await tableExists("tournaments"))
  ? pass("0008 tournaments")
  : fail("0008 tournaments 없음 — 0008_tournaments.sql");
(await tableExists("tournament_participants"))
  ? pass("0008 tournament_participants")
  : fail("0008 tournament_participants 없음 — 0008_tournaments.sql");
(await columnExists("tournament_participants", "team"))
  ? pass("0010 tournament_participants.team")
  : fail("0010 team 컬럼 없음 — 0010_tournament_team.sql");
(await tableExists("tournament_matches"))
  ? pass("0011 tournament_matches")
  : fail("0011 tournament_matches 없음 — 0011_tournament_games.sql");
(await tableExists("tournament_match_sides"))
  ? pass("0011 tournament_match_sides")
  : fail("0011 tournament_match_sides 없음 — 0011_tournament_games.sql");
(await tableExists("tournament_results"))
  ? pass("0012 tournament_results")
  : fail("0012 tournament_results 없음 — 0012_tournament_results.sql");
(await columnExists("tournament_matches", "order_no"))
  ? pass("0013 tournament_matches.order_no")
  : fail("0013 order_no 컬럼 없음 — 0013_tournament_round.sql");

// 0015: 클럽 로고 (컬럼 + 스토리지 버킷)
(await columnExists("clubs", "logo_url"))
  ? pass("0015 clubs.logo_url")
  : fail("0015 clubs.logo_url 없음 — 0015_club_logo.sql");
{
  // 버킷은 anon 권한으로 메타 조회가 막힐 수 있어 best-effort.
  const { data, error } = await sb.storage.getBucket("club-logos");
  if (data?.id === "club-logos") pass("0015 storage 버킷 club-logos (public=" + data.public + ")");
  else if (error) warn("0015 club-logos 버킷 확인 불가(anon 제한) — Supabase Storage에서 수동 확인 권장");
  else fail("0015 club-logos 버킷 없음 — 0015_club_logo.sql 실행 + 버킷 public 확인");
}

// 0016: 소유권 이임 RPC
(await rpcExists("transfer_club_ownership", { _club_id: NIL, _user_id: NIL }))
  ? pass("0016 transfer_club_ownership RPC")
  : fail("0016 transfer_club_ownership RPC 없음 — 0016_transfer_ownership.sql");

// 0018: 회원 출생년도
(await columnExists("club_members", "birth_year"))
  ? pass("0018 club_members.birth_year")
  : fail("0018 club_members.birth_year 없음 — 0018_member_birth_year.sql");

// 0019: QR 셀프 체크인 (토큰 컬럼 + RPC 2개)
(await columnExists("attendance_sessions", "checkin_token"))
  ? pass("0019 attendance_sessions.checkin_token")
  : fail("0019 checkin_token 컬럼 없음 — 0019_qr_self_checkin.sql");
(await rpcExists("get_checkin_roster", { _token: NIL }))
  ? pass("0019 get_checkin_roster RPC")
  : fail("0019 get_checkin_roster RPC 없음 — 0019_qr_self_checkin.sql");
(await rpcExists("self_check_in", { _token: NIL, _member_id: NIL }))
  ? pass("0019 self_check_in RPC")
  : fail("0019 self_check_in RPC 없음 — 0019_qr_self_checkin.sql");

// 0017: 실시간 퍼블리케이션 — anon 으로 pg_publication_tables 조회 불가 → 수동 안내
warn(
  "0017 Realtime 퍼블리케이션은 자동 확인 불가 — SQL Editor에서 확인:\n" +
    "      select tablename from pg_publication_tables where pubname='supabase_realtime'\n" +
    "        and tablename in ('games','game_players','attendance_records');",
);

// ── 결과 ────────────────────────────────────────────────────────
if (failed === 0) {
  console.log("\n✅ 모든 마이그레이션 적용 확인됨");
  process.exit(0);
} else {
  console.log(`\n❌ ${failed}건 누락 — 위 안내의 SQL을 Supabase SQL Editor에서 실행하세요`);
  process.exit(1);
}
