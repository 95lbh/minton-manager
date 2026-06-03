-- =============================================================
-- honey_minton 전체 스키마 통합본 (0001 ~ 0014)
-- 새 Supabase 프로젝트의 SQL Editor에 '한 번에' 붙여넣어 실행하세요.
-- (원본 단일 진실: supabase/migrations/000N_*.sql — 이 파일은 편의용 합본)
-- ⚠️ 맨 끝 0014(pg_cron)에서 막히면, 그 섹션만 빼고 먼저 실행 후
--    Database > Extensions에서 pg_cron 켜고 0014만 따로 실행하세요.
-- =============================================================

-- ██████████████████████████████████████████████████████████████
-- ▶ 0001_init.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 배드민턴 매니저 — 초기 스키마 (MVP 1단계, 일반 운영 데이터)
-- 전제: docs/database.md
-- =============================================================

-- ---------- ENUM ----------
create type club_role as enum ('admin', 'staff');
create type member_gender as enum ('male', 'female', 'other');
create type game_status as enum ('ongoing', 'finished', 'canceled');
create type session_status as enum ('open', 'closed');

-- ---------- 공통: updated_at 트리거 ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- 인증 / 권한
-- =============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     uuid not null references auth.users(id),
  is_temporary boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.club_admins (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       club_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- 현재 사용자가 해당 클럽 소속(admin/staff)인가
create or replace function public.is_club_member(_club_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.club_admins
    where club_id = _club_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(_club_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.club_admins
    where club_id = _club_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- 신규 가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 운영 데이터
-- =============================================================
create table public.club_members (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  gender     member_gender,
  level      smallint,
  phone      text,
  status     text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.courts (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  sort_order smallint not null default 0,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
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
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.attendance_sessions(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  member_id     uuid references public.club_members(id),
  guest_name    text,
  is_guest      boolean not null default false,
  checked_in_at timestamptz not null default now(),
  status        text not null default 'present',
  constraint uq_session_member unique (session_id, member_id)
);

create table public.games (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  court_id   uuid not null references public.courts(id),
  status     game_status not null default 'ongoing',
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_players (
  id                   uuid primary key default gen_random_uuid(),
  game_id              uuid not null references public.games(id) on delete cascade,
  club_id              uuid not null references public.clubs(id) on delete cascade,
  attendance_record_id uuid not null references public.attendance_records(id),
  team                 smallint not null default 1,
  is_active            boolean not null default true,
  unique (game_id, attendance_record_id)
);

-- 중복 배정 방지: 한 출석자는 동시에 1개의 활성(ongoing) 게임에만 속함
create unique index uq_active_player
  on public.game_players (attendance_record_id)
  where is_active;

-- 게임이 종료/취소되면 해당 게임 참가자들을 비활성화
create or replace function public.deactivate_players_on_game_end()
returns trigger language plpgsql as $$
begin
  if new.status in ('finished', 'canceled') and old.status = 'ongoing' then
    update public.game_players
      set is_active = false
      where game_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_deactivate_players
  after update of status on public.games
  for each row execute function public.deactivate_players_on_game_end();

-- ---------- updated_at 트리거 부착 ----------
create trigger trg_clubs_updated   before update on public.clubs               for each row execute function public.set_updated_at();
create trigger trg_members_updated before update on public.club_members        for each row execute function public.set_updated_at();
create trigger trg_courts_updated  before update on public.courts              for each row execute function public.set_updated_at();
create trigger trg_sessions_updated before update on public.attendance_sessions for each row execute function public.set_updated_at();
create trigger trg_games_updated   before update on public.games               for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles           for each row execute function public.set_updated_at();

-- =============================================================
-- 인덱스
-- =============================================================
create index ix_members_club     on public.club_members(club_id) where deleted_at is null;
create index ix_courts_club      on public.courts(club_id) where deleted_at is null;
create index ix_sessions_club    on public.attendance_sessions(club_id, session_date desc);
create index ix_attend_session   on public.attendance_records(session_id);
create index ix_attend_member    on public.attendance_records(member_id);
create index ix_games_session    on public.games(session_id, status);
create index ix_gameplayers_game on public.game_players(game_id);
create index ix_clubadmins_user  on public.club_admins(user_id);

-- =============================================================
-- RLS
-- =============================================================
alter table public.profiles            enable row level security;
alter table public.clubs               enable row level security;
alter table public.club_admins         enable row level security;
alter table public.club_members        enable row level security;
alter table public.courts              enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;
alter table public.games               enable row level security;
alter table public.game_players        enable row level security;

-- profiles: 본인 행만
create policy "own profile select" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- clubs: 소속 멤버는 조회/수정, 생성은 본인 소유로
create policy "club select" on public.clubs for select using (is_club_member(id));
create policy "club insert" on public.clubs for insert with check (owner_id = auth.uid());
create policy "club update" on public.clubs for update using (is_club_member(id)) with check (is_club_member(id));

-- club_admins: 본인 행 조회 + 클럽 admin 관리. (insert는 클럽 소유자 부트스트랩 허용)
create policy "club_admins select" on public.club_admins for select using (user_id = auth.uid() or is_club_member(club_id));
create policy "club_admins insert" on public.club_admins for insert
  with check (is_club_admin(club_id) or exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));
create policy "club_admins modify" on public.club_admins for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "club_admins delete" on public.club_admins for delete using (is_club_admin(club_id));

-- 운영 테이블 공통 패턴: is_club_member(club_id) 면 전체 권한
create policy "members all"  on public.club_members        for all using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "courts all"   on public.courts              for all using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "sessions all" on public.attendance_sessions for all using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "attend all"   on public.attendance_records  for all using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "games all"    on public.games               for all using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "players all"  on public.game_players        for all using (is_club_member(club_id)) with check (is_club_member(club_id));

-- =============================================================
-- 통계 view (MVP: 단순 집계)
-- =============================================================
create or replace view public.member_stats
with (security_invoker = true) as
select
  m.id        as member_id,
  m.club_id   as club_id,
  count(distinct ar.session_id) as attend_cnt,
  count(distinct gp.game_id)    as game_cnt,
  max(g.started_at)             as last_played_at
from public.club_members m
left join public.attendance_records ar on ar.member_id = m.id
left join public.game_players gp       on gp.attendance_record_id = ar.id
left join public.games g               on g.id = gp.game_id
where m.deleted_at is null
group by m.id, m.club_id;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0002_create_club_rpc.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 클럽 생성 RPC (clubs + club_admins 를 한 트랜잭션으로)
-- 클럽 insert 후 owner 를 admin 으로 등록. 둘 중 하나라도 실패하면 롤백.
-- =============================================================
create or replace function public.create_club(
  _name text,
  _is_temporary boolean default false
)
returns public.clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  new_club public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'club name required';
  end if;

  insert into public.clubs (name, owner_id, is_temporary)
  values (trim(_name), auth.uid(), _is_temporary)
  returning * into new_club;

  insert into public.club_admins (club_id, user_id, role)
  values (new_club.id, auth.uid(), 'admin');

  return new_club;
end;
$$;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0003_attendance_guest_and_grade.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0003: 게스트 출석에 성별/실력 추가 + 실력 등급 범위 확장(1~7, S~F)
-- =============================================================

-- 게스트도 성별/실력을 입력받기 위해 컬럼 추가
alter table public.attendance_records
  add column if not exists guest_gender member_gender,
  add column if not exists guest_level  smallint;

-- (참고) club_members.level 은 smallint 라 별도 제약이 없으면 1~7도 그대로 저장 가능.
-- 명시적 체크 제약이 있었다면 여기서 갱신했겠지만, 0001 에는 범위 제약이 없어 변경 불필요.


-- ██████████████████████████████████████████████████████████████
-- ▶ 0004_game_rpc.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0004: 게임 시작/종료 RPC (정합성 보장)
-- =============================================================

-- 게임 시작: games insert + game_players(team1/team2) 일괄 insert 를 한 트랜잭션으로.
-- 코트에 진행 중 게임이 있으면 거부. 중복 배정은 uq_active_player 인덱스가 DB 레벨에서 차단.
create or replace function public.start_game(
  _session_id uuid,
  _court_id   uuid,
  _team1      uuid[],   -- attendance_record_id 배열
  _team2      uuid[]
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  new_game public.games;
  rec uuid;
begin
  -- 세션에서 club_id 조회 + 권한 확인
  select club_id into _club_id
  from public.attendance_sessions
  where id = _session_id;

  if _club_id is null then
    raise exception 'session not found';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;

  -- 코트에 진행 중 게임이 있으면 거부
  if exists (
    select 1 from public.games
    where court_id = _court_id and status = 'ongoing'
  ) then
    raise exception 'court busy';
  end if;

  insert into public.games (club_id, session_id, court_id, status, created_by)
  values (_club_id, _session_id, _court_id, 'ongoing', auth.uid())
  returning * into new_game;

  foreach rec in array _team1 loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (new_game.id, _club_id, rec, 1, true);
  end loop;

  foreach rec in array _team2 loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (new_game.id, _club_id, rec, 2, true);
  end loop;

  return new_game;
end;
$$;

-- 게임 종료: status=finished (트리거 trg_deactivate_players 가 game_players.is_active=false 처리)
create or replace function public.end_game(_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  upd public.games;
begin
  select club_id into _club_id from public.games where id = _game_id;
  if _club_id is null then
    raise exception 'game not found';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;

  update public.games
    set status = 'finished', ended_at = now()
    where id = _game_id and status = 'ongoing'
    returning * into upd;

  if upd.id is null then
    raise exception 'game not ongoing';
  end if;

  return upd;
end;
$$;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0005_court_rename_and_replace_game.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0005: 코트 이름 변경 + 진행 중 게임 멤버/종류 교체 RPC
-- =============================================================

-- 진행 중 게임의 참가자를 통째로 교체한다(멤버 변경 + 인원수 변경=종류 변경).
-- 기존 참가자 삭제 후 새 참가자 insert. 일반 모드라 team=1 고정.
-- 다른 게임과의 중복 배정은 uq_active_player 인덱스가 차단.
create or replace function public.replace_game_players(
  _game_id uuid,
  _players uuid[]   -- attendance_record_id 배열 (2 또는 4명)
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  g public.games;
  rec uuid;
begin
  select club_id into _club_id from public.games
  where id = _game_id and status = 'ongoing';

  if _club_id is null then
    raise exception 'game not ongoing';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;
  if array_length(_players, 1) is null or array_length(_players, 1) < 2 then
    raise exception 'need at least 2 players';
  end if;

  -- 기존 참가자 제거 후 재삽입 (활성 유니크 인덱스 충돌 방지를 위해 먼저 삭제)
  delete from public.game_players where game_id = _game_id;

  foreach rec in array _players loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (_game_id, _club_id, rec, 1, true);
  end loop;

  select * into g from public.games where id = _game_id;
  return g;
end;
$$;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0006_club_sharing.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0006: 클럽 공유(공동 관리자)
--  - clubs.join_code: 클럽당 단일 재생성 참여 코드
--  - 코드로 참여하면 본인을 공동 관리자(admin)로 등록
--  - 클럽 삭제(soft delete)는 최초 생성자(owner = super admin)만
-- 보안: 참여자는 아직 club 멤버가 아니라 RLS insert가 막히므로
--       join_club_by_code는 SECURITY DEFINER로 우회하되, "코드 검증"이 게이트.
--       삭제는 owner_id = auth.uid() 검증으로 일반 update 정책(멤버 허용)을 우회/강화.
-- =============================================================

-- 1) 참여 코드 컬럼 (단일, 재생성 가능). 추측 어려운 uuid.
alter table public.clubs
  add column if not exists join_code uuid not null default gen_random_uuid();

create unique index if not exists uq_clubs_join_code
  on public.clubs (join_code);

-- 2) 참여 코드 재생성 — 해당 클럽 admin 누구나. 새 코드 반환(이전 코드 무효화).
create or replace function public.regenerate_join_code(_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code uuid;
begin
  if not public.is_club_admin(_club_id) then
    raise exception 'not authorized';
  end if;

  update public.clubs
     set join_code = gen_random_uuid()
   where id = _club_id and deleted_at is null
  returning join_code into new_code;

  if new_code is null then
    raise exception 'club not found';
  end if;

  return new_code;
end;
$$;

-- 3) 코드로 클럽 참여 → 본인을 공동 관리자(admin)로 등록.
create or replace function public.join_club_by_code(_code uuid)
returns public.clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target
    from public.clubs
   where join_code = _code and deleted_at is null;

  if target.id is null then
    raise exception 'invalid code';
  end if;

  insert into public.club_admins (club_id, user_id, role)
  values (target.id, auth.uid(), 'admin')
  on conflict (club_id, user_id) do nothing;

  return target;
end;
$$;

-- 4) 클럽 삭제(soft delete) — owner(super admin)만 가능.
create or replace function public.delete_club(_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clubs
     where id = _club_id and owner_id = auth.uid()
  ) then
    raise exception 'only owner can delete';
  end if;

  update public.clubs set deleted_at = now() where id = _club_id;
end;
$$;

-- 5) 실행 권한 (로그인 사용자)
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.join_club_by_code(uuid) to authenticated;
grant execute on function public.delete_club(uuid) to authenticated;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0007_club_admin_guard.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0007: 공동 관리자 관리 + 권한 안전장치 + 임시 클럽 정리
--  - club_admins 변경(insert/update/delete)을 소유자(owner)로 제한
--    (공동 관리자가 소유자/다른 admin을 건드리지 못하게)
--  - list_club_admins: 클럽 관리자 목록(프로필 조인) — 멤버만
--  - remove_club_admin: 소유자가 공동 관리자 내보내기 (owner 본인 제외)
--  - cleanup_temporary_clubs: 오래된 비회원 임시 클럽 정리(스케줄러 전용)
-- 보안: club_admins insert는 create_club / join_club_by_code(둘 다 SECURITY DEFINER)가
--       처리하므로 RLS를 소유자-only로 좁혀도 정상 동작(정의자 함수는 RLS 우회).
-- =============================================================

-- 1) club_admins 변경 정책을 소유자 전용으로 강화 ---------------------------
drop policy if exists "club_admins insert" on public.club_admins;
drop policy if exists "club_admins modify" on public.club_admins;
drop policy if exists "club_admins delete" on public.club_admins;

-- insert: 소유자만 (참여는 join_club_by_code RPC가 정의자 권한으로 처리)
create policy "club_admins insert" on public.club_admins for insert
  with check (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- update(역할 변경 등): 소유자만
create policy "club_admins modify" on public.club_admins for update
  using (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- delete: 소유자가 (owner 본인 행 제외) 내보내거나, 비소유자 본인이 탈퇴
create policy "club_admins delete" on public.club_admins for delete using (
  user_id <> (select owner_id from public.clubs where id = club_id)
  and (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
    or user_id = auth.uid()
  )
);

-- 2) 클럽 관리자 목록(프로필 조인) — 호출자가 멤버일 때만 -----------------
-- profiles는 본인 행만 조회 가능(RLS)하므로, 멤버 검증 후 정의자 권한으로 조인.
create or replace function public.list_club_admins(_club_id uuid)
returns table (
  user_id uuid,
  role club_role,
  display_name text,
  email text,
  is_owner boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ca.user_id,
    ca.role,
    p.display_name,
    p.email,
    (c.owner_id = ca.user_id) as is_owner
  from public.club_admins ca
  join public.clubs c on c.id = ca.club_id
  left join public.profiles p on p.id = ca.user_id
  where ca.club_id = _club_id
    and public.is_club_member(_club_id)
  order by (c.owner_id = ca.user_id) desc, ca.created_at;
$$;

-- 3) 공동 관리자 내보내기 — 소유자만, owner 본인은 제거 불가 ----------------
create or replace function public.remove_club_admin(_club_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clubs where id = _club_id and owner_id = auth.uid()
  ) then
    raise exception 'only owner can remove admins';
  end if;

  if _user_id = (select owner_id from public.clubs where id = _club_id) then
    raise exception 'cannot remove owner';
  end if;

  delete from public.club_admins where club_id = _club_id and user_id = _user_id;
end;
$$;

-- 4) 임시 클럽 정리 — 비회원 임시 클럽이 _days일간 활동 없으면 soft delete ----
-- 활동 기준: 마지막 출석 세션 날짜(없으면 생성일).
-- 스케줄러(service_role/pg_cron)에서만 호출 — authenticated에 권한 부여하지 않음.
create or replace function public.cleanup_temporary_clubs(_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with stale as (
    select c.id
    from public.clubs c
    where c.is_temporary = true
      and c.deleted_at is null
      and coalesce(
        (select max(s.session_date)::timestamptz
           from public.attendance_sessions s where s.club_id = c.id),
        c.created_at
      ) < now() - make_interval(days => _days)
  )
  update public.clubs set deleted_at = now()
  where id in (select id from stale);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 5) 실행 권한 (로그인 사용자) — cleanup은 부여하지 않음(스케줄러 전용)
grant execute on function public.list_club_admins(uuid) to authenticated;
grant execute on function public.remove_club_admin(uuid, uuid) to authenticated;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0008_tournaments.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0008: 대회 모드 — 대회 + 참가자 (기반)
--  일반 모드와 분리된 토너먼트 운영. 이번 증분은 대회 생성 + 참가자 등록까지.
--  대진(matches)·승패/점수(results)는 다음 증분(0009)에서 추가한다.
--  격리: 모든 테이블 club_id + RLS(is_club_member)로 일반 운영 테이블과 동일 패턴.
-- =============================================================

create type tournament_status as enum ('draft', 'ongoing', 'finished');
create type tournament_match_type as enum ('singles', 'doubles');

create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  match_type  tournament_match_type not null default 'doubles',
  status      tournament_status not null default 'draft',
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index idx_tournaments_club on public.tournaments (club_id) where deleted_at is null;

create table public.tournament_participants (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  member_id     uuid references public.club_members(id) on delete set null,
  name          text not null,
  seed          int,
  created_at    timestamptz not null default now()
);

create index idx_tparticipants_tournament on public.tournament_participants (tournament_id);
-- 회원 연결 참가자는 같은 대회에 중복 등록 방지(게스트 신규는 동명 허용)
create unique index uq_tparticipant_member
  on public.tournament_participants (tournament_id, member_id)
  where member_id is not null;

create trigger trg_tournaments_updated before update on public.tournaments
  for each row execute function public.set_updated_at();

-- RLS: club 격리 (운영 테이블 공통 패턴)
alter table public.tournaments            enable row level security;
alter table public.tournament_participants enable row level security;

create policy "tournaments all" on public.tournaments for all
  using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "tparticipants all" on public.tournament_participants for all
  using (is_club_member(club_id)) with check (is_club_member(club_id));


-- ██████████████████████████████████████████████████████████████
-- ▶ 0009_tournament_participant_info_and_structure.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0009: 대회 참가자 성별/급수 + 대회 형식(구조)
--  - 참가자에 gender/level 비정규화 저장(회원은 복사, 게스트는 입력)
--    → 대진 편성 알고리즘이 모든 참가자 정보를 균일하게 읽도록.
--  - tournaments.structure: 토너먼트 / 리그전 / 청팀백팀 (참가자 등록 후 선택)
-- =============================================================

alter table public.tournament_participants
  add column if not exists gender public.member_gender,
  add column if not exists level  smallint;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tournament_structure') then
    create type tournament_structure as enum ('tournament', 'league', 'team_split');
  end if;
end $$;

alter table public.tournaments
  add column if not exists structure tournament_structure;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0010_tournament_team.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0010: 청팀/백팀(team_split) — 참가자 팀 배정 컬럼
--  tournament_participants.team: 'blue'(청팀) / 'white'(백팀) / null(미배정)
--  자동 편성(균형 분배) 또는 수동 이동으로 설정.
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tournament_team') then
    create type tournament_team as enum ('blue', 'white');
  end if;
end $$;

alter table public.tournament_participants
  add column if not exists team tournament_team;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0011_tournament_games.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0011: 청팀/백팀 게임 편성 — 게임(matches) + 사이드(match_sides) + 인당 게임수 설정
--  tournaments.games_per_player: 인당 보장 게임 수(설정값)
--  tournament_matches: 게임 1건(order_no 순서)
--  tournament_match_sides: 게임의 양 팀 참가자(team=blue/white)
-- 격리: 모든 테이블 club_id + RLS(is_club_member).
-- =============================================================

alter table public.tournaments
  add column if not exists games_per_player int not null default 4;

create table if not exists public.tournament_matches (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  order_no      int not null default 0,
  status        text not null default 'scheduled',
  created_at    timestamptz not null default now()
);

create index if not exists idx_tmatches_tournament
  on public.tournament_matches (tournament_id, order_no);

create table if not exists public.tournament_match_sides (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  match_id       uuid not null references public.tournament_matches(id) on delete cascade,
  team           tournament_team not null,
  participant_id uuid not null references public.tournament_participants(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index if not exists idx_tsides_match
  on public.tournament_match_sides (match_id);

alter table public.tournament_matches     enable row level security;
alter table public.tournament_match_sides enable row level security;

create policy "tmatches all" on public.tournament_matches for all
  using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "tsides all" on public.tournament_match_sides for all
  using (is_club_member(club_id)) with check (is_club_member(club_id));


-- ██████████████████████████████████████████████████████████████
-- ▶ 0012_tournament_results.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0012: 대회 게임 결과(승패/점수) — 대회 모드 전용(일반 모드는 승패 기록 없음)
--  tournament_results: 게임당 1건(match_id unique), 청/백 점수. 승자는 점수로 판정.
-- =============================================================

create table if not exists public.tournament_results (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  match_id    uuid not null unique references public.tournament_matches(id) on delete cascade,
  score_blue  int not null default 0,
  score_white int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_tresults_updated before update on public.tournament_results
  for each row execute function public.set_updated_at();

alter table public.tournament_results enable row level security;

create policy "tresults all" on public.tournament_results for all
  using (is_club_member(club_id)) with check (is_club_member(club_id));


-- ██████████████████████████████████████████████████████████████
-- ▶ 0013_tournament_round.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0013: 토너먼트(싱글 엘리미네이션) — 게임에 라운드 표기
--  tournament_matches.round: 1=첫 라운드, 2,3...=상위 라운드. (리그/청백은 null)
-- =============================================================

alter table public.tournament_matches
  add column if not exists round int;


-- ██████████████████████████████████████████████████████████████
-- ▶ 0014_cleanup_cron.sql
-- ██████████████████████████████████████████████████████████████
-- =============================================================
-- 0014: 임시(비회원) 클럽 자동 정리 스케줄러
-- -------------------------------------------------------------
-- cleanup_temporary_clubs(_days)는 이미 0007에 정의돼 있으나(스케줄러 전용),
-- 실제 주기 실행이 등록돼 있지 않아 자동 삭제가 동작하지 않았다.
-- 여기서 pg_cron으로 매일 1회 실행하도록 등록한다.
--
-- 기준: 임시 클럽이 마지막 활동(출석 세션 날짜, 없으면 생성일)으로부터
--       7일간 활동이 없으면 soft delete(deleted_at).
--
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행한다.
--    pg_cron 확장이 비활성이면 Dashboard > Database > Extensions에서 켜거나
--    아래 create extension 으로 활성화한다.
-- =============================================================

create extension if not exists pg_cron;

-- 동일 이름 작업이 이미 있으면 제거(재실행 안전).
do $$
begin
  perform cron.unschedule('cleanup-temp-clubs');
exception when others then
  null; -- 등록된 작업이 없으면 무시
end$$;

-- 매일 18:00 UTC(= 익일 03:00 KST, 저트래픽 시간) 실행.
select cron.schedule(
  'cleanup-temp-clubs',
  '0 18 * * *',
  $$ select public.cleanup_temporary_clubs(7); $$
);

-- 확인:
--   select * from cron.job where jobname = 'cleanup-temp-clubs';
--   select * from cron.job_run_details order by start_time desc limit 5;
-- 보관 기간 변경: cleanup_temporary_clubs(N) 의 N(일) 을 조정.
-- 해제: select cron.unschedule('cleanup-temp-clubs');

