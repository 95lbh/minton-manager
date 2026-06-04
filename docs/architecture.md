# Architecture — 마이민턴 (myminton)

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

- **첫 진입은 로그인 페이지가 아니라 비회원 시작이 기본.** `/`가 랜딩([features/auth/landing-auth.tsx](../src/features/auth/landing-auth.tsx))이며 메인 CTA가 **"비회원으로 바로 시작"**(`signInAnonymously`), 그 아래에 Google·Kakao 로그인(연동)을 보조로 둔다. 별도 `/login`은 `/`로 리다이렉트하는 호환용 별칭.
- 로그인 = **Google · Kakao OAuth(Supabase Auth)**. 두 provider 모두 Supabase 기본 지원이라 `signInWithOAuth({provider})` 한 줄로 처리. (Naver는 Supabase 기본 미지원 → 커스텀 OAuth 플로우 필요해 보류.) 로그인 주체는 **운영자/스태프뿐**.
- **Proxy**(`src/proxy.ts`, Next 16에서 middleware의 새 이름)가 매 요청 세션을 갱신하고 보호 경로를 가드. 공개 경로(`/login`, `/auth`, `/`)를 제외한 모든 경로가 보호 대상이며, **미인증 시 `/`(비회원 시작 랜딩)로** 리다이렉트. 2차로 `(app)/layout.tsx` 서버 컴포넌트가 `getUser()`로 재확인.
- 권한 매핑:
  - `profiles` (auth user 1:1) — 표시 정보
  - `club_admins(club_id, user_id, role)` — 어떤 사용자가 어떤 클럽의 admin/staff인지
- 모든 데이터 접근은 **RLS로 `club_id` 격리**(앱 코드 + DB 이중 방어). 상세 정책은 [database.md](database.md).

### 비회원 일회성 운영 (구현됨)
계정 없이 운영하려면 **Supabase 익명 로그인(anonymous sign-in)** 사용 → `auth.uid()`가 생겨 RLS를 그대로 적용. 흐름:
- 랜딩(`/`) 메인 CTA **"비회원으로 바로 시작"** → `signInAnonymously()` → 온보딩에서 클럽 생성.
- `createClub`이 `user.is_anonymous`를 감지해 **`is_temporary=true`** 로 임시 클럽 생성(RPC `create_club`의 `_is_temporary`).
- 앱 셸 상단에 **체험 모드 배너**(`is_temporary` 클럽일 때) — 데이터 보관·통계 제한 안내.
- **정식 전환**: 배너의 "Google/Kakao로 전환" → `linkIdentity({provider})`로 익명 계정에 소셜 계정 연결 → 콜백(`/auth/callback`)에서 `is_anonymous`가 풀리면 본인 소유 임시 클럽을 `is_temporary=false`로 승격(데이터 유지).
- Supabase 대시보드 선행 설정 필요: **Anonymous sign-ins 허용**, **Allow manual linking**(linkIdentity), Kakao provider. (임시 클럽 만료/정리 정책은 추후 확정)

### 클럽 공유 / 공동 관리자 (구현됨, 0006)
한 클럽을 여러 운영자가 함께 관리. 권한 2단계:
- **최고 관리자(super admin) = `clubs.owner_id`**(최초 생성자) — 유일하게 **클럽 삭제** 가능.
- **공동 관리자** = `club_admins` 행(role `admin`) — 운영 전반 가능, **삭제 불가**.

흐름: 설정 탭에서 클럽당 단일 **`join_code`**(uuid, 재생성 가능)를 공유 → 다른 운영자가 로그인 후 코드 입력 → 같은 클럽의 공동 관리자로 합류.
- RPC(0006): `join_club_by_code`(SECURITY DEFINER — 비멤버의 self-가입을 코드 검증으로만 허용), `regenerate_join_code`(클럽 admin), `delete_club`(owner 검증 — 멤버 허용인 일반 update 정책을 우회/강화해 owner만 soft delete).
- 보안: definer 함수는 모두 **호출자(auth.uid()) 본인**만 대상으로 동작하고 코드/소유자 검증을 게이트로 둠. 코드는 추측 어려운 uuid이며 유출 의심 시 재생성으로 무효화.

**관리자 관리(0007)**
- 설정 탭에서 관리자 목록(소유자/공동 관리자)을 보고, **소유자만** 공동 관리자를 내보낼 수 있음.

**소유권 이임(0016)**
- **소유자만** 기존 공동 관리자에게 클럽 소유권을 이임 가능(설정 탭 관리자 목록의 "소유권 이임", 확인창으로 실수 방지). 흐름: 공유 코드로 운영자 초대 → 그 사람에게 이임.
- RPC `transfer_club_ownership(_club_id, _user_id)`(SECURITY DEFINER): 현재 소유자 본인 검증 → `clubs.owner_id` 이전 + 대상 role admin 보장. **이전 소유자는 admin 공동 관리자로 잔류**(클럽 삭제 등 소유자 전용 권한은 상실). 임시 클럽·자기 자신 이임은 차단.
- RPC: `list_club_admins`(멤버만, profiles는 본인만 조회 가능한 RLS를 멤버 검증 후 정의자 조인으로 우회), `remove_club_admin`(소유자만·owner 본인 제거 불가).
- **권한 안전장치**: `club_admins`의 insert/update/delete RLS를 **소유자 전용**으로 강화(삭제는 비소유자 본인 탈퇴만 예외). 공동 관리자가 소유자/다른 admin 행을 건드릴 수 없음. (가입은 `join_club_by_code` 정의자 함수가 처리하므로 정상 동작.)
- **임시 클럽 공유 차단**: `is_temporary` 클럽은 설정에서 공유 코드/참여/관리자 목록 UI를 숨김 — 정식 전환 후 공유 가능.

**임시 클럽 정리 정책(0007)**
- 비회원 임시 클럽이 **마지막 활동(마지막 출석 세션 날짜, 없으면 생성일)로부터 7일** 지나면 soft delete.
- `cleanup_temporary_clubs(_days int default 7)` 함수가 일괄 처리. **스케줄러 전용**(authenticated 권한 미부여) — Supabase pg_cron 또는 Edge Function cron에서 주기 호출 예정. (현재 함수만 정의, 스케줄 등록은 운영 단계에서.)

### 대회 모드 (기반 구현됨, 0008)
일반 모드와 분리된 토너먼트 운영. 이번 증분은 **대회 생성 + 참가자 등록**까지.
- 테이블(0008): `tournaments`(name, `match_type` 단식/복식, status) · `tournament_participants`(member 연결 또는 신규, name, seed). 모두 `club_id` + RLS(`is_club_member`) 격리.
- 화면: `/tournaments`(목록·생성 다이얼로그) → `/tournaments/[id]`(참가자 등록: 회원에서 추가 / 신규(게스트) 추가 / 제거, 대회 삭제).
- **다음 증분(0009 예정)**: 대진(matches)·팀 구성(match_sides, 복식)·승패/점수(results)·자동 편성/브래킷. 일반 모드는 여전히 승패/점수 없음(대회 모드 전용).

## 4. 폴더 구조 (계획)

```txt
src/
  app/
    login/                         # 로그인 (공개)
    auth/callback/                 # OAuth 콜백 (route handler)
    (app)/                         # 보호 영역 (운영자/스태프). 라우트 그룹 → URL 접두사 없음
      layout.tsx                   #   인증 가드 + 공통 셸
      dashboard/
      members/  attendance/  courts/  games/  stats/  settings/
      tournaments/                 # 대회 모드 (별도)
    layout.tsx  page.tsx  globals.css
  proxy.ts                         # Next 16 proxy (구 middleware)
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
