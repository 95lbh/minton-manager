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
