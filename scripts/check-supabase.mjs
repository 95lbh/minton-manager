// Supabase 연동 점검 스크립트 (비밀값 출력 안 함)
// 실행: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ .env.local 의 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 비어 있습니다.");
  process.exit(1);
}
console.log("✓ 환경변수 로드됨 (URL 호스트:", new URL(url).host + ")");

// 1) Auth 설정: 소셜 provider / 익명 로그인 활성화 여부
const mark = (on) => (on ? "활성화됨 ✅" : "비활성화 ❌");
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  const s = await res.json();
  console.log("✓ Auth 접속 OK");
  console.log("  · Google 로그인:", mark(s?.external?.google));
  console.log("  · Kakao 로그인:", mark(s?.external?.kakao));
  console.log("  · 익명(비회원) 로그인:", mark(s?.external?.anonymous_users));
} catch (e) {
  console.error("❌ Auth 설정 조회 실패:", e.message);
}

// 2) 테이블 접근 (RLS로 0행이어도 에러 없으면 OK)
const sb = createClient(url, key);
const tables = [
  "clubs",
  "club_members",
  "courts",
  "attendance_sessions",
  "attendance_records",
  "games",
  "game_players",
];
let allOk = true;
for (const t of tables) {
  const { error } = await sb.from(t).select("*", { head: true, count: "exact" });
  if (error) {
    allOk = false;
    console.log(`  ✗ ${t}: ${error.message}`);
  } else {
    console.log(`  ✓ ${t}`);
  }
}
console.log(allOk ? "\n✅ 스키마/연결 정상" : "\n⚠️ 일부 테이블 접근 실패 — 0001_init.sql 실행 여부 확인");

// 3) create_club RPC 존재 여부 (0002 적용 확인). 인자 없이 호출 → 함수 없으면 PGRST202.
const { error: rpcErr } = await sb.rpc("create_club", { _name: "" });
if (rpcErr?.code === "PGRST202") {
  console.log("\n❌ create_club RPC 없음 — supabase/migrations/0002_create_club_rpc.sql 실행 필요");
} else {
  // 함수는 있으나 비인증/빈이름으로 막힌 것(정상). RLS/인증 에러는 함수 존재를 의미.
  console.log("\n✅ create_club RPC 존재 (0002 적용됨)");
}

// 4) 0003: attendance_records.guest_gender 컬럼 존재 여부
const { error: colErr } = await sb
  .from("attendance_records")
  .select("guest_gender, guest_level", { head: true });
if (colErr && /guest_gender|column/.test(colErr.message)) {
  console.log("❌ 게스트 성별/실력 컬럼 없음 — supabase/migrations/0003_attendance_guest_and_grade.sql 실행 필요");
} else {
  console.log("✅ 게스트 성별/실력 컬럼 존재 (0003 적용됨)");
}

// 5) 0006: clubs.join_code 컬럼 + 공유 RPC 존재 여부
const { error: jcErr } = await sb.from("clubs").select("join_code").limit(1);
if (jcErr && /join_code|column|42703/.test(jcErr.message + (jcErr.code ?? ""))) {
  console.log("❌ clubs.join_code 없음 — supabase/migrations/0006_club_sharing.sql 실행 필요");
} else {
  console.log("✅ clubs.join_code 존재 (0006 적용됨)");
}
const { error: joinRpcErr } = await sb.rpc("join_club_by_code", {
  _code: "00000000-0000-0000-0000-000000000000",
});
if (joinRpcErr?.code === "PGRST202") {
  console.log("❌ join_club_by_code RPC 없음 — 0006_club_sharing.sql 실행 필요");
} else {
  console.log("✅ join_club_by_code RPC 존재 (0006 적용됨)");
}
