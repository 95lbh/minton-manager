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
