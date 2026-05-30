# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어

이 프로젝트의 모든 대화·설명·문서·커밋 메시지는 **한국어**로 작성한다.

## 프로젝트 상태

**배드민턴 매니저** — 배드민턴 동호회 관리자가 출석·코트 배정·게임 진행·통계를 운영하는 멀티테넌트 웹앱. URL로 어떤 기기·브라우저에서든 접속하는 반응형 웹 서비스이며 PWA 설치도 지원한다.

두 가지 운영 모드가 있다:
- **일반 운영 모드**: 평소 게임 운영. **승패/점수는 기록하지 않고** 게임 횟수와 파트너/상대만 남긴다.
- **대회 모드(별도)**: 토너먼트/리그 — **승패·점수·대진표(수동/자동)·대회 기록**까지 관리. 데이터·화면 분리.

**MVP 1단계 진행 중.** Next.js 16 + Supabase 연동 완료(인증·RLS 동작). 구현된 것: Google 로그인, 클럽 온보딩/전환, **회원 CRUD**, **코트 CRUD**, 코트 배정 알고리즘(순수함수+테스트). 아직인 것: 출석 관리, 코트 배정 화면(알고리즘 연결), 게임 시작/종료, 통계, 대회 모드. 설계 문서(`docs/`)를 먼저 두고 그에 맞춰 구현하는 **문서 우선(docs-first)** 워크플로를 따른다.

전체 요구사항·MVP 범위·데이터 모델은 [docs/prd.md](docs/prd.md), 구조는 [docs/architecture.md](docs/architecture.md), 스키마는 [docs/database.md](docs/database.md)가 단일 진실 공급원(source of truth)이다. 작업 시작 전 반드시 읽는다. DB 스키마 원본은 [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).

## 제품 방향성 (모든 설계 결정의 기준)

- 회원은 **최소 조작**. 조작 주체는 관리자다.
- 관리자가 **빠르게** 출석·게임을 관리하고, **코트 현황이 한눈에** 보여야 한다.
- 운영 중 **실수 방지**(중복 배정·기록 유실)가 최우선 안정성 목표.
- **모바일 우선** UX. "멋진 앱"이 아니라 "현장 운영 도구".

## 기술 스택 (확정)

- **Frontend**: Next.js (App Router) · TypeScript (strict) · React · Tailwind CSS · shadcn/ui · Zustand 또는 React Query · dnd-kit(드래그앤드롭)
- **Backend/DB**: Supabase (PostgreSQL · Auth · Row Level Security · Edge Functions/API Routes)
- **배포**: Vercel + Supabase Cloud
- **기타**: PWA·오프라인 캐시는 3단계 확장 항목

## 핵심 아키텍처 원칙

이 프로젝트를 이해하려면 다음 횡단 개념을 먼저 파악해야 한다 (개별 파일만 봐서는 드러나지 않음):

- **멀티테넌트**: 모든 운영 데이터의 기본 단위는 `club`이다. 모든 운영 테이블은 `club_id`를 가지며, **Supabase RLS로 `club_id` 기준 격리**를 강제한다. 어떤 쿼리도 club 경계를 넘지 않아야 한다.
- **인증 모델**: 로그인하는 사용자는 **운영자(Club Admin)/스태프(Staff)뿐**이다(Google OAuth). **회원(`club_members`)은 로그인하지 않으며** 관리자가 관리하는 데이터일 뿐이다 — auth와 혼동하지 말 것. 전역 사용자 마스터(`users`)는 없고 `club_members`로 통합한다. 계정 없는 **비회원 일회성 운영** 경로도 존재한다.
- **모드 분리**: 일반 모드에는 승패/점수 테이블이 없다(`game_players`로 파트너/상대만 기록). **승패·점수·대진은 대회 모드 전용 테이블**(`tournaments`, `tournament_matches`, `tournament_results` 등)에만 존재한다.
- **Soft delete**: hard delete 대신 `deleted_at` 사용. 공통 컬럼: `id, club_id, created_at, updated_at, deleted_at, created_by, status`.
- **정합성**: 게임 시작/종료·코트 배정 등은 **트랜잭션 + DB 제약**으로 보장. 한 회원이 진행 중인 두 게임에 동시 배정될 수 없다(중복 배정 방지는 DB 레벨에서도 막는다).
- **레이어 분리**: 서버 로직과 UI 로직 분리. Supabase 쿼리 함수는 `server/queries`·`server/mutations`로 분리. 서버 컴포넌트/클라이언트 컴포넌트 역할을 명확히 구분.

### 데이터 레이어 패턴 (확립됨 — 따를 것)
- **읽기**: 서버 컴포넌트(page.tsx)에서 `server/queries/*` 호출 → props로 클라이언트 매니저 컴포넌트에 전달.
- **쓰기**: `server/mutations/*`의 **Server Action**(`"use server"`)으로 처리하고 끝에 `revalidatePath`. 반환은 `ActionResult`([src/server/types.ts](src/server/types.ts)) — `{ ok: true } | { ok: false, error }`.
- **클라이언트 매니저**(`features/<domain>/*-manager.tsx`)는 `useTransition`으로 액션 호출 → 성공/실패를 `sonner` 토스트로, 성공 시 `router.refresh()`. 패턴 예시: [features/members/members-manager.tsx](src/features/members/members-manager.tsx), [features/courts/courts-manager.tsx](src/features/courts/courts-manager.tsx).
- **활성 클럽**: `active_club_id` 쿠키로 관리. 모든 도메인 쿼리는 [getActiveClub()](src/server/queries/clubs.ts)으로 `club_id`를 얻어 필터. 클럽 없으면 `(app)/layout.tsx`가 `/onboarding`으로 보냄.
- **클럽 생성**은 `clubs`+`club_admins` 두 테이블을 함께 써야 하므로 **`create_club` RPC**(트랜잭션, [0002](supabase/migrations/0002_create_club_rpc.sql))로 처리. 여러 테이블 동시 변경/정합성 필요 시 RPC를 우선 고려.
- **실력 등급**: DB는 `level` smallint(1~7), UI는 **S/A/B/C/D/E/F**(S=7 … F=1). 변환은 [constants](src/lib/constants/index.ts)의 `SKILL_VALUE`/`GRADE_BY_VALUE`. 게스트도 성별/실력을 가짐(`attendance_records.guest_gender/guest_level`, 0003).
- **성별 입력**은 셀렉트가 아니라 남/여 토글 버튼([components/ui/gender-toggle.tsx](src/components/ui/gender-toggle.tsx), 다시 누르면 해제). 등급은 셀렉트 유지.
- **회원은 soft delete만** (활성/비활성 상태 개념 제거). `club_members.status`는 더 이상 UI에서 쓰지 않음.

### 마이그레이션 적용
`supabase/migrations/*.sql`은 자동 적용되지 않는다. **Supabase SQL Editor에 수동 실행**한다(현재 CLI 미연결). 적용 여부는 `scripts/check-supabase.mjs`로 확인.
- **자동 배정 로직**은 규칙 기반으로 시작하되, 추후 AI 추천으로 교체 가능하도록 인터페이스를 분리해 설계한다.

## 계획된 폴더 구조

```txt
src/
  app/         # App Router 페이지 (auth, dashboard, clubs, members,
               #   attendance, courts, games, stats, settings)
  components/  # ui(shadcn) + 도메인별 컴포넌트
  features/    # 도메인별 기능 모듈 (auth, clubs, members, ...)
  lib/         # supabase, utils, constants
  hooks/  stores/  types/
  server/      # queries, mutations, services
  styles/
supabase/      # migrations, seed
docs/          # prd, architecture, database, design-system, agent-harness, qa-checklist
```

## 작업 규칙 (Agent Harness)

- **순서를 지킨다**: 설계 → 변경 범위 제안 → 구현 → 검증. 코드 생성 전 현재 폴더 구조를 확인한다.
- **한 번에 너무 많은 파일을 만들거나 수정하지 않는다.** 기능별 작은 단위로 진행한다.
- 새 컴포넌트 생성 전 **기존 컴포넌트·디자인 시스템을 우선 재사용**한다.
- **DB 변경 시 반드시 `supabase/migrations`에 migration 파일을 작성**한다. RLS 정책 변경 시 보안 영향을 설명한다.
- 구현 후 **테스트 시나리오를 작성**한다([docs/qa-checklist.md] 기준 — 정상/예외/보안/성능/회귀).
- TypeScript strict, `any` 최소화. 관리자 파괴적 작업은 confirm/undo 고려, 모바일 터치·접근성 기본 준수.

## 토큰 효율화

- 작업 시작 시 현재 범위를 먼저 요약. 전체 코드 반복 출력 금지, **변경 파일/diff 중심**으로 설명.
- 공통 규칙은 `docs/`에 두고 참조. 같은 설명 반복 금지. 불확실한 부분은 가정으로 명시하고 진행.

## 빌드/테스트 명령

- `npm run dev` — 개발 서버 (Turbopack, http://localhost:3000)
- `npm run build` — 프로덕션 빌드 + 타입체크 (코드 검증 시 이걸 돌린다)
- `npm run start` — 빌드 결과 실행
- `npm run lint` — ESLint

Supabase 환경변수(`.env.local`)가 없으면 dev 서버는 뜨되 인증은 비활성화되고 보호 페이지는 "Supabase 설정 필요" 안내를 보여준다([src/lib/env.ts](src/lib/env.ts)의 `hasSupabaseEnv`). `.env.example`를 복사해 채운다.

- 연동 점검: `node --env-file=.env.local scripts/check-supabase.mjs` — 환경변수/Auth/Google provider/테이블 접근을 한 번에 확인(비밀값 미출력).
- ⚠️ `NEXT_PUBLIC_SUPABASE_URL`은 **프로젝트 기본 URL**(`https://xxx.supabase.co`)이어야 한다. Data API 엔드포인트(`.../rest/v1/`)를 넣으면 안 됨.
- `.env.local` 변경 후에는 dev 서버를 **재시작**해야 반영된다.
- ⚠️ **dev 서버가 떠 있는 동안 `npm run build`나 `npm install`을 돌리지 말 것.** dev(`next dev`)와 production build가 같은 `.next`를 두고 충돌해 캐시가 꼬이면 기본 템플릿/빈 페이지가 서빙된다. 증상이 보이면: dev 서버 종료 → `rm -rf .next` → `npm run dev` 재시작 → 브라우저 강력 새로고침(Ctrl+Shift+R).

## Next.js 16 주의 (중요)

설치된 버전은 **Next.js 16**(15 아님)이라 학습 데이터와 다를 수 있다. `node_modules/next/dist/docs/`에 실제 문서가 있으니 불확실하면 먼저 읽는다. 이 프로젝트에서 이미 확인한 차이:

- **Middleware → Proxy**: 루트 규칙 파일은 `src/middleware.ts`가 아니라 **`src/proxy.ts`** 이고 `proxy` 함수를 export 한다(기능 동일). 세션 갱신 헬퍼는 [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts).
- **`cookies()`/`params`/`searchParams`는 async** → `await` 필수. 그래서 서버 Supabase 클라이언트 `createClient()`도 async다([src/lib/supabase/server.ts](src/lib/supabase/server.ts)).
- **라우트 그룹 `(app)`** 은 URL에 접두사를 만들지 않는다. 즉 `src/app/(app)/dashboard` → `/dashboard`. 경로 상수는 [src/lib/constants/index.ts](src/lib/constants/index.ts)의 `ROUTES`를 단일 출처로 쓴다(하드코딩 금지).
