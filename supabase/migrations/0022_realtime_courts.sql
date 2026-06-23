-- =============================================================
-- 0022: 실시간 동기화에 courts 추가
--  - 다른 스태프의 코트 추가/이름변경/삭제가 코트 화면에 라이브 반영되도록
--    courts 를 supabase_realtime 퍼블리케이션에 추가.
--  - filter(club_id=eq)가 UPDATE/DELETE 에서도 동작하도록 REPLICA IDENTITY FULL.
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행.
-- =============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'courts'
  ) then
    execute 'alter publication supabase_realtime add table public.courts';
  end if;
end$$;

alter table public.courts replica identity full;
