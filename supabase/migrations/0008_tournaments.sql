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
