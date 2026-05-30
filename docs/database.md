# Database — 배드민턴 매니저

> 상태: 초안 (v0.1) · 2026-05-30 · 전제: [prd.md](prd.md), [architecture.md](architecture.md)
> 아래 SQL은 `supabase/migrations`에 들어갈 초안. MVP 1단계(일반 운영)를 우선 확정하고, 대회 모드는 2단계에서 구체화한다.

## 1. 설계 원칙

- 모든 운영 테이블에 `club_id` + 공통 컬럼(`created_at, updated_at, deleted_at, created_by, status` 중 해당되는 것).
- **RLS는 항상 ON.** 접근 가능 여부는 "내가 그 클럽의 admin/staff인가"로 판단.
- 삭제는 `deleted_at` **soft delete** 우선.
- 게임 참가자는 `club_members`가 아니라 **`attendance_records`를 참조** → "출석한 사람만 배정"이 FK로 보장되고 게스트도 자연스럽게 포함.
- PK는 `uuid` (`gen_random_uuid()`), 시간은 `timestamptz`.

## 2. ENUM / 공통

```sql
create type club_role as enum ('admin', 'staff');
create type member_gender as enum ('male', 'female', 'other');
create type game_status as enum ('ongoing', 'finished', 'canceled');
create type session_status as enum ('open', 'closed');

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
```

## 3. 인증 / 권한

```sql
-- auth.users 1:1 프로필
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     uuid not null references auth.users(id),
  is_temporary boolean not null default false,   -- 비회원 일회성 운영
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- 어떤 로그인 사용자가 어떤 클럽의 admin/staff 인지
create table public.club_admins (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      club_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- RLS 핵심 헬퍼: 현재 사용자가 해당 클럽 소속(admin/staff)인가
create or replace function public.is_club_member(_club_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.club_admins
    where club_id = _club_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(_club_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.club_admins
    where club_id = _club_id and user_id = auth.uid() and role = 'admin'
  );
$$;
```

## 4. 운영 데이터 (MVP 1단계)

```sql
create table public.club_members (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  gender      member_gender,
  level       smallint,                 -- 실력 (1~N, null 허용)
  phone       text,
  status      text not null default 'active',  -- active / inactive
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.courts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  session_date date not null default current_date,
  name         text,
  status       session_status not null default 'open',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.attendance_records (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.attendance_sessions(id) on delete cascade,
  club_id      uuid not null references public.clubs(id) on delete cascade,
  member_id    uuid references public.club_members(id),  -- 게스트면 null
  guest_name   text,                                     -- 게스트 표시명
  is_guest     boolean not null default false,
  checked_in_at timestamptz not null default now(),
  status       text not null default 'present',          -- present / left
  -- 같은 세션에 회원 중복 출석 방지 (게스트 제외)
  constraint uq_session_member unique (session_id, member_id)
);

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  session_id  uuid not null references public.attendance_sessions(id) on delete cascade,
  court_id    uuid not null references public.courts(id),
  status      game_status not null default 'ongoing',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 게임 참가자: 출석 레코드를 참조 (= 출석자만 배정 가능, 게스트 포함)
create table public.game_players (
  id                    uuid primary key default gen_random_uuid(),
  game_id               uuid not null references public.games(id) on delete cascade,
  club_id               uuid not null references public.clubs(id) on delete cascade,
  attendance_record_id  uuid not null references public.attendance_records(id),
  team                  smallint not null default 1,   -- 1 / 2 (파트너/상대 구분)
  unique (game_id, attendance_record_id)
);
```

### 중복 배정 방지 (한 사람이 동시에 두 진행중 게임에 못 들어감)
부분 유니크 인덱스로 DB 레벨에서 차단(진행중 게임만 대상):
```sql
create unique index uq_active_player
  on public.game_players (attendance_record_id)
  where (true);  -- 아래 트리거/조건으로 'ongoing' 게임만 유효하게 관리
```
> 구현 메모: 위는 단순화. 정확히 "ongoing 게임에 한해 1회"를 강제하려면 `game_players`에 `is_active boolean` 비정규화 컬럼을 두고 게임 종료 시 false로 갱신, 그 컬럼에 `where is_active` 부분 유니크 인덱스를 거는 방식을 채택한다(트리거 또는 종료 mutation에서 처리). 최종 방식은 마이그레이션 작성 시 확정.

## 5. 인덱스

```sql
create index ix_members_club    on public.club_members(club_id) where deleted_at is null;
create index ix_courts_club     on public.courts(club_id) where deleted_at is null;
create index ix_sessions_club   on public.attendance_sessions(club_id, session_date desc);
create index ix_attend_session  on public.attendance_records(session_id);
create index ix_attend_member   on public.attendance_records(member_id);
create index ix_games_session   on public.games(session_id, status);
create index ix_gameplayers_game on public.game_players(game_id);
create index ix_clubadmins_user on public.club_admins(user_id);
```

## 6. RLS 정책 (패턴)

모든 운영 테이블에 동일 패턴 적용: **읽기/쓰기 모두 `is_club_member(club_id)`** 통과해야 함. (회원/코트 삭제 등 민감 작업은 `is_club_admin`로 강화 가능)

```sql
alter table public.club_members enable row level security;

create policy "club members readable by club staff"
  on public.club_members for select
  using (is_club_member(club_id));

create policy "club members writable by club staff"
  on public.club_members for all
  using (is_club_member(club_id))
  with check (is_club_member(club_id));
```
> `courts`, `attendance_sessions`, `attendance_records`, `games`, `game_players` 에 동일 패턴 반복.
> `clubs`: select/update는 `is_club_member(id)`, insert는 `owner_id = auth.uid()`.
> `club_admins`: 관리(추가/삭제)는 `is_club_admin(club_id)`만.
> `profiles`: 본인 행만(`id = auth.uid()`).

## 7. 집계 / 통계

MVP는 쿼리로 계산, 이후 view/materialized view로 분리.
```sql
create or replace view public.member_stats as
select
  m.id as member_id, m.club_id,
  count(distinct ar.session_id) filter (where ar.id is not null) as attend_cnt,
  count(distinct gp.game_id)                                     as game_cnt,
  max(g.started_at)                                              as last_played_at
from public.club_members m
left join public.attendance_records ar on ar.member_id = m.id
left join public.game_players gp on gp.attendance_record_id = ar.id
left join public.games g on g.id = gp.game_id
where m.deleted_at is null
group by m.id, m.club_id;
```

## 8. 대회 모드 (2단계 — 초안 개요)

일반 운영과 분리. **여기서만 승패·점수.** 상세 SQL은 2단계 진입 시 확정.
```
tournaments(id, club_id, name, format, status, ...)
tournament_participants(id, tournament_id, club_id, member_id?, name, seed)
tournament_matches(id, tournament_id, club_id, round, position, status)
tournament_match_sides(id, match_id, side, participant_id)   -- 복식 대비 팀 구성
tournament_results(id, match_id, winner_side, score_a, score_b)
```
RLS는 운영 데이터와 동일 패턴(`is_club_member`).

## 8b. 적용된 추가 마이그레이션
- `0002_create_club_rpc.sql` — 클럽 생성 트랜잭션 RPC.
- `0003_attendance_guest_and_grade.sql` — `attendance_records`에 `guest_gender`, `guest_level` 추가. 실력 등급은 1~7(S~F)로 사용(컬럼은 smallint 그대로).

## 9. 마이그레이션 순서
1. enum + `set_updated_at`
2. profiles, clubs, club_admins + 헬퍼 함수
3. club_members, courts
4. attendance_sessions, attendance_records
5. games, game_players (+ 중복 배정 인덱스)
6. 인덱스, RLS 정책
7. member_stats view
8. (2단계) 대회 테이블
