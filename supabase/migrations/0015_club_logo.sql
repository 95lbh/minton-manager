-- =============================================================
-- 0015: 클럽 커스텀 로고
-- -------------------------------------------------------------
-- clubs.logo_url 컬럼 + Supabase Storage 공개 버킷(club-logos) + Storage RLS.
-- 객체 경로 규칙: "<club_id>/logo.webp" — 첫 폴더가 club_id.
-- 읽기는 공개(공개 버킷), 업로드/수정/삭제는 해당 클럽 멤버만(is_club_member).
--
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행한다.
-- =============================================================

-- 1) 로고 URL 컬럼
alter table public.clubs add column if not exists logo_url text;

-- 2) 공개 버킷 (이미 있으면 무시)
insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

-- 3) Storage RLS (storage.objects)
--    읽기: 공개 버킷이므로 누구나. 쓰기 계열은 경로 첫 폴더(club_id) 멤버만.
drop policy if exists "club-logos read" on storage.objects;
create policy "club-logos read" on storage.objects
  for select using (bucket_id = 'club-logos');

drop policy if exists "club-logos insert" on storage.objects;
create policy "club-logos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-logos'
    and public.is_club_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "club-logos update" on storage.objects;
create policy "club-logos update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-logos'
    and public.is_club_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'club-logos'
    and public.is_club_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "club-logos delete" on storage.objects;
create policy "club-logos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-logos'
    and public.is_club_member(((storage.foldername(name))[1])::uuid)
  );

-- 확인:
--   select id, public from storage.buckets where id = 'club-logos';
--   select polname from pg_policies where tablename = 'objects' and policyname like 'club-logos%';
