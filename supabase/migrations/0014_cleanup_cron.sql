-- =============================================================
-- 0014: 임시(비회원) 클럽 자동 정리 스케줄러
-- -------------------------------------------------------------
-- cleanup_temporary_clubs(_days)는 이미 0007에 정의돼 있으나(스케줄러 전용),
-- 실제 주기 실행이 등록돼 있지 않아 자동 삭제가 동작하지 않았다.
-- 여기서 pg_cron으로 매일 1회 실행하도록 등록한다.
--
-- 기준: 임시 클럽이 마지막 활동(출석 세션 날짜, 없으면 생성일)으로부터
--       7일간 활동이 없으면 soft delete(deleted_at).
--
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행한다.
--    pg_cron 확장이 비활성이면 Dashboard > Database > Extensions에서 켜거나
--    아래 create extension 으로 활성화한다.
-- =============================================================

create extension if not exists pg_cron;

-- 동일 이름 작업이 이미 있으면 제거(재실행 안전).
do $$
begin
  perform cron.unschedule('cleanup-temp-clubs');
exception when others then
  null; -- 등록된 작업이 없으면 무시
end$$;

-- 매일 18:00 UTC(= 익일 03:00 KST, 저트래픽 시간) 실행.
select cron.schedule(
  'cleanup-temp-clubs',
  '0 18 * * *',
  $$ select public.cleanup_temporary_clubs(7); $$
);

-- 확인:
--   select * from cron.job where jobname = 'cleanup-temp-clubs';
--   select * from cron.job_run_details order by start_time desc limit 5;
-- 보관 기간 변경: cleanup_temporary_clubs(N) 의 N(일) 을 조정.
-- 해제: select cron.unschedule('cleanup-temp-clubs');
