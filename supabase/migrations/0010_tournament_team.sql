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
