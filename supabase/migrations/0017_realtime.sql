-- =============================================================
-- 0017: 실시간 동기화 (Supabase Realtime)
-- -------------------------------------------------------------
-- 코트/대기열/출석을 여러 스태프 기기에 라이브 반영하기 위해
-- games / game_players / attendance_records 를 supabase_realtime
-- 퍼블리케이션에 추가한다.
--
--  - postgres_changes 구독은 테이블 RLS(is_club_member)를 그대로 적용 →
--    구독자는 자기 클럽 변경만 수신(테넌트 격리 유지).
--  - REPLICA IDENTITY FULL: club_id=eq 필터가 UPDATE/DELETE 에서도 동작하도록
--    이전 행의 모든 컬럼을 복제에 포함시킨다(기본은 PK만).
--
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행한다.
-- =============================================================

-- 1) 퍼블리케이션에 테이블 추가 (이미 포함돼 있으면 건너뜀)
do $$
declare
  t text;
begin
  foreach t in array array['games', 'game_players', 'attendance_records']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;

-- 2) 필터(club_id=eq)가 모든 이벤트에서 동작하도록 REPLICA IDENTITY FULL
alter table public.games replica identity full;
alter table public.game_players replica identity full;
alter table public.attendance_records replica identity full;

-- 확인:
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public'
--     and tablename in ('games','game_players','attendance_records');
