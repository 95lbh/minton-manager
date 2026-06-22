-- =============================================================
-- 0020: 사용자 환경설정 (계정별 광고 제거)
--  - user_prefs(user_id) : 로그인 사용자 단위 설정. ad_free=true면 광고 숨김.
--  - 본인 행만 읽기/쓰기(RLS). 클럽이 아닌 auth 사용자 단위.
-- =============================================================

create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  ad_free    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_prefs' and policyname = 'own prefs select') then
    create policy "own prefs select" on public.user_prefs
      for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_prefs' and policyname = 'own prefs insert') then
    create policy "own prefs insert" on public.user_prefs
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_prefs' and policyname = 'own prefs update') then
    create policy "own prefs update" on public.user_prefs
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
