-- =============================================================
-- 0021: 정합성·격리 보강 (코드 검토 1차 배치)
--  1) self_check_in: 동시 체크인 경합 시 unique_violation을 잡아 'already' 반환
--     (DB는 막지만 클라이언트가 일반 오류 토스트를 받던 문제 해결)
--  2) member_id가 같은 club_id 소속인지 BEFORE INSERT/UPDATE 트리거로 강제
--     (Postgres는 CHECK 안 서브쿼리 미지원 → 트리거로 구현)
--     대상: attendance_records, tournament_participants
--  3) member_stats 뷰: 취소(canceled) 게임은 집계에서 제외
-- =============================================================

-- 1) QR 셀프 체크인 경합 처리 -------------------------------------------------
create or replace function public.self_check_in(_token uuid, _member_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session attendance_sessions;
  v_member  club_members;
begin
  select * into v_session from attendance_sessions where checkin_token = _token;
  if v_session.id is null then
    raise exception 'invalid token';
  end if;
  if v_session.status <> 'open' then
    raise exception 'session closed';
  end if;

  select * into v_member from club_members
    where id = _member_id and club_id = v_session.club_id and deleted_at is null;
  if v_member.id is null then
    raise exception 'invalid member';
  end if;

  if exists (
    select 1 from attendance_records r
    where r.session_id = v_session.id and r.member_id = _member_id
  ) then
    return 'already';
  end if;

  insert into public.attendance_records (session_id, club_id, member_id, is_guest, status)
    values (v_session.id, v_session.club_id, _member_id, false, 'present');

  return 'ok';
exception
  -- 동시 요청으로 둘 다 위 SELECT를 통과한 뒤 한쪽이 uq_session_member 에 걸린 경우.
  when unique_violation then
    return 'already';
end;
$$;

-- 2) member_id ↔ club_id 일치 강제 (클럽 간 ID 주입 차단) ---------------------
create or replace function public.assert_member_in_club()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.member_id is not null and not exists (
    select 1 from public.club_members m
    where m.id = new.member_id and m.club_id = new.club_id
  ) then
    raise exception 'member % does not belong to club %', new.member_id, new.club_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_member_club on public.attendance_records;
create trigger trg_attendance_member_club
  before insert or update on public.attendance_records
  for each row execute function public.assert_member_in_club();

drop trigger if exists trg_tparticipant_member_club on public.tournament_participants;
create trigger trg_tparticipant_member_club
  before insert or update on public.tournament_participants
  for each row execute function public.assert_member_in_club();

-- 3) 통계 뷰: 취소 게임 제외 ---------------------------------------------------
create or replace view public.member_stats
with (security_invoker = true) as
select
  m.id        as member_id,
  m.club_id   as club_id,
  count(distinct ar.session_id) as attend_cnt,
  count(distinct gp.game_id) filter (where g.status is distinct from 'canceled') as game_cnt,
  max(g.started_at)          filter (where g.status is distinct from 'canceled') as last_played_at
from public.club_members m
left join public.attendance_records ar on ar.member_id = m.id
left join public.game_players gp       on gp.attendance_record_id = ar.id
left join public.games g               on g.id = gp.game_id
where m.deleted_at is null
group by m.id, m.club_id;
