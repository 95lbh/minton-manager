-- =============================================================
-- 마이민턴(myminton) — 초기 스키마 (MVP 1단계, 일반 운영 데이터)
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
