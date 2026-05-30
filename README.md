# 배드민턴 매니저 (minton-manager)

배드민턴 동호회 **관리자가 출석·코트 배정·게임 진행·통계를 빠르게 운영**하는 멀티테넌트 웹앱.
URL로 어떤 기기·브라우저에서든 접속하며, PWA 설치도 지원할 예정입니다.

> 회원은 로그인하지 않습니다. 운영 주체(클럽 운영자/스태프)만 로그인하고, 회원은 관리 대상 데이터로만 존재합니다.

## 기술 스택

- **Frontend**: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui
- **상태/상호작용**: React Query · Zustand · dnd-kit
- **Backend**: Supabase (PostgreSQL · Auth(Google OAuth) · RLS)
- **테스트**: Vitest
- **배포**: Vercel + Supabase Cloud

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. Supabase 설정
1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/`의 파일을 순서대로 실행 (`0001` → `0002`)
3. Authentication → Providers → **Google** 활성화 (Google Cloud OAuth 클라이언트 필요)
4. Authentication → URL Configuration: Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**`

### 3. 환경변수
`.env.example`를 복사해 `.env.local`을 만들고 값을 채웁니다.
```bash
cp .env.example .env.local
```
> `NEXT_PUBLIC_SUPABASE_URL`은 **프로젝트 기본 URL**(`https://xxx.supabase.co`)을 넣습니다. (`/rest/v1/` 붙이지 않음)

연동 점검:
```bash
node --env-file=.env.local scripts/check-supabase.mjs
```

### 4. 개발 서버
```bash
npm run dev   # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 + 타입체크 |
| `npm run lint` | ESLint |
| `npm test` | 단위 테스트 (Vitest) |

## 문서

설계·기획 문서는 [`docs/`](docs/)에 있습니다.

- [`prd.md`](docs/prd.md) — 제품 요구사항 / MVP 범위 / 데이터 구조
- [`architecture.md`](docs/architecture.md) — 시스템 구조 / 폴더 구조 / 인증 흐름
- [`database.md`](docs/database.md) — DB 스키마 / RLS / 인덱스
- [`assignment.md`](docs/assignment.md) — 코트 자동 배정 알고리즘

프로젝트 작업 규칙은 [`CLAUDE.md`](CLAUDE.md) 참고.

## 현재 상태 (MVP 1단계)

✅ Google 로그인 · 클럽 온보딩/전환 · 회원 관리 · 코트 관리 · 코트 배정 알고리즘(+테스트)
🚧 출석 관리 · 코트 배정/게임 화면 · 통계 · 대회 모드
