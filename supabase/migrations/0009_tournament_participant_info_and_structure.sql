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
