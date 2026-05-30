/** 앱 전역 라우트 상수. (app) 라우트 그룹이므로 URL에는 접두사가 없다. */
export const ROUTES = {
  home: "/",
  login: "/login",
  authCallback: "/auth/callback",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  clubs: "/clubs",
  members: "/members",
  attendance: "/attendance",
  courts: "/courts",
  games: "/games",
  stats: "/stats",
  tournaments: "/tournaments",
  settings: "/settings",
} as const;

/** 성별 표시 라벨. */
export const GENDER_LABEL: Record<string, string> = {
  male: "남",
  female: "여",
  other: "기타",
};

/** 로그인 없이 접근 가능한 경로(접두사). 나머지는 모두 보호 경로. */
export const PUBLIC_PATH_PREFIXES = ["/login", "/auth"] as const;

/** 해당 경로가 공개 경로인지. (홈 "/"은 별도로 허용 — 홈에서 대시보드로 리다이렉트) */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

/** 클럽 내 로그인 사용자 권한. 회원(club_members)은 로그인하지 않으므로 여기 없음. */
export const CLUB_ROLES = ["admin", "staff"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

/** 실력 등급(높은 순) ↔ 내부 숫자값. DB는 smallint(1~5)로 저장하고 UI에서 등급으로 표시. */
export const SKILL_GRADES = ["S", "A", "B", "C", "D"] as const;
export type SkillGrade = (typeof SKILL_GRADES)[number];
export const SKILL_VALUE: Record<SkillGrade, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};
export const GRADE_BY_VALUE: Record<number, SkillGrade> = {
  5: "S",
  4: "A",
  3: "B",
  2: "C",
  1: "D",
};
/** 실력 미상(게스트 등) 기본값 = B */
export const DEFAULT_SKILL_VALUE = 3;

/** 자동 배정 팀 구성 모드. */
export const COMPOSITIONS = ["free", "mens", "womens", "mixed"] as const;
export type Composition = (typeof COMPOSITIONS)[number];
export const COMPOSITION_LABEL: Record<Composition, string> = {
  free: "자유(성별 무관)",
  mens: "남복",
  womens: "여복",
  mixed: "혼복",
};

export const APP_NAME = "배드민턴 매니저";
