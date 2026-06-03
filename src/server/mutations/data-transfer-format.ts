/**
 * 회원 백업 파일 포맷 정의(타입·상수).
 * "use server" 파일은 async 함수만 export 할 수 있어, 타입/상수는 이 모듈에 둔다.
 * 실제 동작(export/import)은 [data-transfer.ts]의 Server Action.
 */
import type { MemberGender } from "@/types/db";

export const MEMBER_BUNDLE_VERSION = 1;

/** 백업 파일에 담기는 회원 1명. (운영 식별자·기록은 제외, 순수 명단 정보만) */
export interface MemberExportRow {
  name: string;
  gender: MemberGender | null;
  level: number | null;
  phone: string | null;
}

/** 회원 목록 백업 번들(JSON 파일로 저장됨). */
export interface MemberBundle {
  app: "myminton";
  type: "members";
  version: number;
  exportedAt: string;
  club: { name: string };
  members: MemberExportRow[];
}

export type ImportMode = "overwrite" | "merge";
