-- =============================================================
-- 0019: QR 셀프 출석 체크인 (방법 A — 세션 QR + 이름 선택)
--  - attendance_sessions 에 공개 체크인 토큰(checkin_token) 추가
--  - 비로그인(anon) 방문자가 토큰으로만 접근하는 SECURITY DEFINER RPC 2개:
--      get_checkin_roster(token) : 명단 + 출석 여부
--      self_check_in(token, member_id) : 토큰 검증 후 출석 추가(중복 방지)
--  - RLS(is_club_member)는 그대로 두고, RPC가 토큰으로 범위를 스스로 제한한다.
--    (회원은 로그인하지 않으므로 일반 RLS로는 셀프 체크인이 불가능)
-- =============================================================

alter table public.attendance_sessions
  add column if not exists checkin_token uuid not null default gen_random_uuid();

create unique index if not exists ux_sessions_checkin_token
  on public.attendance_sessions(checkin_token);

-- 명단 조회: 토큰으로 세션을 찾아 클럽 회원 목록 + 출석 여부 반환.
create or replace function public.get_checkin_roster(_token uuid)
returns table (
  session_id uuid,
  club_name text,
  session_date date,
  session_status text,
  member_id uuid,
  member_name text,
  gender member_gender,
  level smallint,
  present boolean
)
language sql
security definer
set search_path = public
as $$
  select
    s.id, c.name, s.session_date, s.status,
    m.id, m.name, m.gender, m.level,
    exists (
      select 1 from attendance_records r
      where r.session_id = s.id and r.member_id = m.id
    ) as present
  from attendance_sessions s
  join clubs c on c.id = s.club_id and c.deleted_at is null
  join club_members m on m.club_id = s.club_id and m.deleted_at is null
  where s.checkin_token = _token
  order by m.name;
$$;

-- 셀프 체크인: 토큰 검증 후 회원 출석 추가(이미 있으면 'already').
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
end;
$$;

grant execute on function public.get_checkin_roster(uuid) to anon, authenticated;
grant execute on function public.self_check_in(uuid, uuid) to anon, authenticated;
