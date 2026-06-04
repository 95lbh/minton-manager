# QA 체크리스트 (출시 전)

마이민턴(myminton) 출시/배포 전 점검표. 카테고리: **정상 · 예외 · 보안 · 성능 · 회귀 · 모바일/접근성 · PWA/배포**.
각 기능 구현 후 해당 시나리오를 수동 점검한다. (CLAUDE.md 작업 규칙 §테스트 시나리오)

> 측정/설치 동작은 반드시 **프로덕션 빌드**(`npm run build && npm run start`)에서 확인. dev는 prefetch·SW 비활성.

## 1. 정상 흐름 (해피 패스)
- [ ] 비회원 진입 → 대시보드 → 클럽 이름 수정
- [ ] 출석: 회원 체크인(연타) · 게스트 추가 · 출석 취소
- [ ] 코트/게임: 직접 배정 / 자동 배정(남복 기본) · 시작 · 멤버 수정 · 종료
- [ ] 대기열: 남/여 2열, 오래 기다린 순 정렬, n분 대기 표시
- [ ] 회원 CRUD · 코트 추가/이름변경/삭제
- [ ] 통계: 요약·성별 구성·급수 분포·회원별 표
- [ ] 회원 백업/불러오기: 내보내기(JSON 다운로드) · 불러오기 병합(같은 이름 제외) · 불러오기 덮어쓰기(기존 비우고 교체) · 잘못된 파일 거부
- [ ] 클럽 로고: 업로드(256px 리사이즈) → 헤더·클럽 목록 반영 · 변경 · 제거 · 다른 클럽 사용자 업로드 차단(Storage RLS) · 버킷(club-logos) 공개 읽기
- [ ] 대회: 토너먼트/리그/청백전 생성 → 참가자 → 대진 → 결과 입력 → 상태 종료
- [ ] 로그인 전환(Google/Kakao) 후 임시 클럽 정식 승격 + 데이터 유지
- [ ] 클럽 공유 코드 발급/참여, 공동 관리자 내보내기
- [ ] 전체화면 토글

## 2. 예외 / 엣지케이스
- [ ] 출석/통계: 클럽 없음 · 세션 없음 · 인원 0명에서 빈 상태 정상
- [ ] 배정 인원 부족(2명 미만/혼복 남녀 부족) 안내 토스트
- [ ] 동시 배정 충돌(같은 코트/같은 사람 두 게임) — DB가 차단 + 안내
- [ ] 게임 이력 있는 출석자 출석 취소 차단 안내
- [ ] 낙관적 UI 실패 시 롤백 + 에러 토스트(체크인/게임시작/상태변경)
- [ ] 파괴적 작업 confirm: 회원/코트/대회 삭제, 데이터 초기화, **대회 대진 재생성(3종 모두)**
- [ ] 네트워크 오프라인 → PWA offline.html 폴백
- [ ] 이미 가입된 소셜 계정으로 "전환" 시도 → identity_already_exists 감지 → 기존 계정 로그인으로 자동 전환(AuthErrorHandler) · 그 외 OAuth 에러는 토스트 안내 + URL 정리

## 3. 보안 (멀티테넌트)
- [ ] 클럽 A 사용자가 클럽 B 데이터 조회/수정 불가 (RLS)
- [ ] 모든 운영/대회 테이블 RLS 활성 + `with check` 존재
- [ ] SECURITY DEFINER RPC가 내부 권한(is_club_member/owner) 검증 + `search_path=public`
- [ ] service_role 키 클라이언트 미노출(코드 import 0건)
- [ ] **운영 DB에 익명(anon) GRANT/공개 RPC 잔존 없음** (구 QR 기능 잔재 확인)
- [ ] 콜백 `redirect` 파라미터 오픈 리다이렉트 방어
- [ ] 에러 detail에 DB 원문 미노출(클라엔 사용자 메시지)
- [ ] 익명 로그인 남용 방지(Supabase Auth rate limit/CAPTCHA 검토)

## 4. 성능
- [ ] 서울 리전 확인(왕복 지연 최소)
- [ ] 탭 전환: loading 스켈레톤 즉시 + prefetch(prod)
- [ ] 액션 체감: 낙관적 UI 즉시 반영, 중복 refresh 없음
- [ ] 코트 조회는 세션 범위(게임 누적돼도 일정)
- [ ] 큰 명단(40명+)에서 대기열/후보 스크롤 정상

## 5. 회귀
- [ ] `npm run build` 통과(타입/lint) · 단위 테스트(`npx vitest run`) 통과
- [ ] 운영일 경계(KST 06:00) 동작 — 자정 넘겨도 세션 유지, 06시 이후 새 날
- [ ] 임시 클럽 cleanup cron 등록 확인(`select * from cron.job`)
- [ ] 데이터 초기화 후 통계/목록 0으로 갱신

## 6. 모바일 / 접근성
- [ ] 주요 액션 버튼 터치 타깃 ≥ ~40px(아이콘 버튼 포함)
- [ ] 아이콘 전용 버튼 aria-label, 폼 input 라벨 연결
- [ ] 성별 등 정보가 색상만으로 전달되지 않음(텍스트 보조)
- [ ] 좁은 폰: 헤더/내비/표/브래킷 오버플로·겹침 없음(가로 스크롤 힌트)
- [ ] iOS 입력 시 자동 확대 없음(16px 기준)
- [ ] sticky 헤더와 토스트/콘텐츠 겹침 없음

## 7. PWA / 배포
- [ ] manifest(`/manifest.webmanifest`) 로드, 아이콘 192/512 표시
- [ ] Chrome 설치 프롬프트(HTTPS), 독립 창 실행
- [ ] iOS "홈 화면에 추가" 아이콘 적용
- [ ] Service Worker 등록(prod) + offline 폴백
- [ ] Vercel 환경변수(URL/anon) · OAuth 리디렉트 URL(prod 도메인) 등록
- [ ] 구 프로젝트(리전 이전 전) 정리

---

## 이번 감사 발견 결함 (2026-06, 우선순위)

### 높음 (출시 전 처리 권장)
1. **대회 청백전 재생성 confirm 누락** — `src/features/tournaments/team-games-manager.tsx:108` `generate`가 확인 없이 기존 게임·점수 삭제 후 재생성. league/tournament와 달리 유일하게 confirm 없음 → 점수 유실. **실제 버그.**
2. **운영 DB anon 잔재 확인(사용자 액션)** — 구 QR 기능(공개 RPC, `to anon` grant)을 옛 DB에 수동 적용했었다면 잔존 가능. 새 서울 프로젝트는 `setup_all.sql`(QR 없음)이라 영향 없을 가능성이 크나, `select … from information_schema.role_routine_grants where grantee='anon'`로 확인.
3. **터치 타깃 과소** — `src/components/ui/button.tsx`(default `h-8`/icon `size-8`), court-board·attendance의 `p-1` 아이콘 버튼. 현장 모바일 오조작. 1차 액션부터 ≥40px로.

### 중간
4. **콜백 오픈 리다이렉트** — `src/app/auth/callback/route.ts` `redirect`를 `/`로 시작 + `//`·`/\` 아님일 때만 허용.
5. **에러 detail 노출** — mutation들이 `error.message`를 클라에 detail로 반환. 서버 로그로만.
6. **클럽 없음 시 `return null` vs `redirect` 불일치** — attendance/games/stats/tournaments 페이지. settings처럼 `redirect(onboarding)`로 통일(빈 화면 방지).
7. **대회 화면 갱신 일관성** — tournaments는 detail 경로만 revalidate + `router.refresh()` 의존. attendance/games의 revalidate-only(+낙관적) 패턴과 불일치(회귀 위험). 점수 저장 피드백/낙관적 UI 부재로 깜빡임.
8. **a11y 빠른 보강** — members 수정/삭제 버튼 aria-label, 검색 input 라벨, 성별 아바타 텍스트 보조.
9. **반응형** — stats 표 가로 스크롤 래퍼, league/team-games MatchRow 줄바꿈 정렬, 브래킷/내비 스크롤 힌트, court-board 대기열 모바일 max-height.

### 낮음
- 코트 0개일 때 안내 부재(첫 진입 가이드)
- `confirm()` vs 다이얼로그 일관성, 점수 onBlur 저장 피드백
- setSeedOrder 비트랜잭션, 콜백 승격 실패 무시, 동일 게스트 중복 추가, 이중 클릭, clipboard 비보안 환경 fallback

> 보안 멀티테넌트 격리는 RLS로 견고하며 코드 레벨 High 위험은 없음(감사 결론). 위 보안 항목은 견고화·운영 설정 위주.
