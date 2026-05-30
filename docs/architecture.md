# Architecture — 배드민턴 매니저

> 상태: 초안 (v0.1) · 2026-05-30 · 전제: [prd.md](prd.md)

## 1. 시스템 개요

```
[브라우저/PWA]  ──HTTPS──►  [Next.js (Vercel)]  ──►  [Supabase]
  운영자/스태프                App Router               Postgres + Auth(RLS)
  (반응형 웹)         서버 컴포넌트 / Server Actions      Storage / Edge Fn
```

- **Next.js(App Router)** 한 앱에서 UI + 서버 로직(Server Actions / Route Handlers)을 함께 운영. 별도 백엔드 서버 없음.
- **Supabase**가 DB·인증·권한(RLS)·(추후 Storage/Realtime) 담당.
- **Vercel** 배포 → URL만 알면 어떤 기기/브라우저에서든 접속(반응형). PWA 설치 지원(3단계).

## 2. 렌더링·데이터 전략

| 구분 | 방식 |
|---|---|
| 인증·초기 데이터·목록 조회 | **서버 컴포넌트** + Supabase 서버 클라이언트 |
| 변경(출석/배정/게임) | **Server Actions** 또는 Route Handler → `server/mutations` |
| 실시간 운영 화면(코트 배정) | 클라이언트 컴포넌트 + React Query(낙관적 업데이트, 롤백) |
| 전역 UI 상태(드래그 중 등) | Zustand (서버 상태와 분리) |

원칙: **서버 상태 = React Query / 서버 컴포넌트**, **클라이언트 UI 상태 = Zustand**. 둘을 섞지 않는다.

## 3. 인증 / 권한 흐름

- 로그인 = **Google OAuth(Supabase Auth)**. 로그인 주체는 **운영자/스태프뿐**.
- 미들웨어(`middleware.ts`)가 세션을 확인하고 `/dashboard` 등 보호 경로를 가드.
- 권한 매핑:
  - `profiles` (auth user 1:1) — 표시 정보
  - `club_admins(club_id, user_id, role)` — 어떤 사용자가 어떤 클럽의 admin/staff인지
- 모든 데이터 접근은 **RLS로 `club_id` 격리**(앱 코드 + DB 이중 방어). 상세 정책은 [database.md](database.md).

### 비회원 일회성 운영
계정 없이 운영하려면 **Supabase 익명 로그인(anonymous sign-in)** 사용 → `auth.uid()`가 생겨 RLS를 그대로 적용. 해당 클럽은 `clubs.is_temporary=true`로 표시하고 영속/통계는 제한. (정리 정책은 추후 확정)

## 4. 폴더 구조 (계획)

```txt
src/
  app/
    (auth)/login/                  # 로그인
    (app)/                         # 보호 영역 (운영자/스태프)
      dashboard/
      clubs/  members/  attendance/  courts/  games/  stats/  settings/
      tournaments/                 # 대회 모드 (별도)
    api/                           # Route Handlers (필요 시)
    layout.tsx  globals.css
  components/
    ui/                            # shadcn/ui
    layout/                        # 헤더/네비/쉘
    <domain>/                      # members, attendance, courts, games, tournaments ...
  features/<domain>/               # 도메인 훅·로직(클라이언트)
  server/
    queries/                       # 읽기 (서버 전용)
    mutations/                     # 쓰기 (Server Actions)
    services/                      # 도메인 규칙(배정 로직 등)
  lib/
    supabase/                      # server.ts / client.ts / middleware.ts
    utils/  constants/
  hooks/  stores/  types/  styles/
supabase/
  migrations/                      # SQL (DB 변경 시 필수)
  seed/
docs/
```

## 5. 핵심 서비스 로직 위치

- **코트 자동 배정 추천**: `server/services/assignment.ts` — 입력(출석자·코트·이력)→추천 결과를 반환하는 **순수 함수**로 분리(규칙 기반 → 추후 AI 교체 가능, [prd.md] 4.2).
- **대회 대진 생성**: `server/services/bracket.ts` — 토너먼트/리그 대진 생성(수동/자동) 분리.
- **게임 시작/종료, 출석 처리**: `server/mutations/*` 에서 **트랜잭션**으로 정합성 보장.

## 6. API/응답 규칙 (Harness)

- Server Action/Handler 반환은 `{ ok: true, data } | { ok: false, error: { code, message } }` 형태로 통일.
- 에러는 사용자 친화 메시지 + 내부 code 분리. 권한 실패는 RLS가 1차, 앱 가드가 2차.
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용), Google OAuth는 Supabase 대시보드에서 설정.

## 7. 배포

- Vercel(Next.js) + Supabase Cloud. 마이그레이션은 `supabase/migrations`로 버전 관리.
- 프리뷰/프로덕션 환경변수 분리. RLS는 항상 ON.
