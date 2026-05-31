/** 앱 전역 라우트 상수. (app) 라우트 그룹이므로 URL에는 접두사가 없다. */
export const ROUTES = {
  home: "/",
  login: "/login",
  authCallback: "/auth/callback",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  members: "/members",
  attendance: "/attendance",
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

/** 대회 상태 / 경기 형식 표시 라벨. */
export const TOURNAMENT_STATUS_LABEL = {
  draft: "준비중",
  ongoing: "진행중",
  finished: "종료",
} as const;
export const MATCH_TYPE_LABEL = {
  singles: "단식",
  doubles: "복식",
} as const;
export const TOURNAMENT_STRUCTURE_LABEL = {
  tournament: "토너먼트",
  league: "리그전",
  team_split: "청팀/백팀",
} as const;

/** 출석자(대기자) 상태. present 만 코트 배정 가능. */
export const ATTENDEE_STATUSES = ["present", "lesson", "left"] as const;
export type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number];
export const ATTENDEE_STATUS_LABEL: Record<AttendeeStatus, string> = {
  present: "대기중",
  lesson: "레슨중",
  left: "집에감",
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

/** 실력 등급(높은 순) ↔ 내부 숫자값. DB는 smallint(1~7)로 저장하고 UI에서 등급으로 표시. */
export const SKILL_GRADES = ["S", "A", "B", "C", "D", "E", "F"] as const;
export type SkillGrade = (typeof SKILL_GRADES)[number];
export const SKILL_VALUE: Record<SkillGrade, number> = {
  S: 7,
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  E: 2,
  F: 1,
};
export const GRADE_BY_VALUE: Record<number, SkillGrade> = {
  7: "S",
  6: "A",
  5: "B",
  4: "C",
  3: "D",
  2: "E",
  1: "F",
};
/** 실력 미상(게스트 등) 기본값 = C (중간) */
export const DEFAULT_SKILL_VALUE = 4;

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
