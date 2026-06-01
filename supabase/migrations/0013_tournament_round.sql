-- =============================================================
-- 0013: 토너먼트(싱글 엘리미네이션) — 게임에 라운드 표기
--  tournament_matches.round: 1=첫 라운드, 2,3...=상위 라운드. (리그/청백은 null)
-- =============================================================

alter table public.tournament_matches
  add column if not exists round int;
