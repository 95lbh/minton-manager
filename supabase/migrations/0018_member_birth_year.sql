-- =============================================================
-- 0018: 회원 출생년도(birth_year) 추가
-- 회원 탭/출석 탭에서 표시하고, 통계의 나이대 분포에 사용한다.
-- 기존 회원은 NULL(미지정) 유지. 범위는 합리적인 연도로 제한(1900~2100).
-- =============================================================

alter table public.club_members
  add column if not exists birth_year smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'club_members_birth_year_range'
  ) then
    alter table public.club_members
      add constraint club_members_birth_year_range
      check (birth_year is null or (birth_year between 1900 and 2100));
  end if;
end $$;
