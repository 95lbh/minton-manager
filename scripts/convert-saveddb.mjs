/**
 * temp/savedDB.txt (다른 앱에서 복사한 회원 목록)를 마이민턴 "회원 불러오기" JSON으로 변환.
 *
 * 원본 형식(5줄 반복): 등급 / 이름 / "YYYY년 • 남성|여성" / "수정" / "삭제"
 * 실행: node scripts/convert-saveddb.mjs
 * 출력: temp/members-import.json  → 설정 > 회원 불러오기 에서 사용
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "temp", "savedDB.txt");
const OUT = join(root, "temp", "members-import.json");

const GRADE_TO_LEVEL = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

const lines = readFileSync(SRC, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l !== "수정" && l !== "삭제");

const members = [];
const warnings = [];

for (let i = 0; i + 2 < lines.length; ) {
  const grade = lines[i];
  if (!(grade in GRADE_TO_LEVEL)) {
    // 등급으로 시작하지 않으면 한 줄 밀고 재시도(형식 어긋남 방어).
    warnings.push(`등급 아님, 건너뜀: "${grade}"`);
    i += 1;
    continue;
  }
  const name = lines[i + 1];
  const info = lines[i + 2];
  i += 3;

  const yearMatch = info.match(/(\d{4})\s*년/);
  const birthYear = yearMatch ? Number(yearMatch[1]) : null;
  const gender = info.includes("남성")
    ? "male"
    : info.includes("여성")
      ? "female"
      : null;

  members.push({
    name,
    gender,
    level: GRADE_TO_LEVEL[grade],
    birthYear,
    phone: null,
  });
}

const bundle = {
  app: "myminton",
  type: "members",
  version: 1,
  exportedAt: new Date().toISOString(),
  club: { name: "가져온 회원" },
  members,
};

writeFileSync(OUT, JSON.stringify(bundle, null, 2), "utf8");

// ── 요약 출력 ──
const dupNames = members
  .map((m) => m.name)
  .filter((n, idx, arr) => arr.indexOf(n) !== idx);
console.log(`변환 완료: ${members.length}명 → ${OUT}`);
if (dupNames.length)
  console.log(`동명이인(중복 이름): ${[...new Set(dupNames)].join(", ")}`);
if (warnings.length) console.log("경고:\n" + warnings.join("\n"));
