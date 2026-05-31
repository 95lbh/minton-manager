-- =============================================================
-- 0006: QR 셀프 출석 (세션 토큰 + 공개 RPC)
-- 로그인하지 않은 회원이 토큰으로만 해당 세션에 출석할 수 있게 한다.
-- 모든 함수는 SECURITY DEFINER 로 RLS 를 우회하되, 토큰 일치 + 세션 open 을 강제.
-- =============================================================

-- 세션에 추측 불가 체크인 토큰 추가
alter table public.attendance_sessions
  add column if not exists checkin_token uuid not null default gen_random_uuid();

create unique index if not exists uq_sessions_checkin_token
  on public.attendance_sessions (checkin_token);

-- ---------- 내부 헬퍼: 토큰으로 유효한(open) 세션 찾기 ----------
create or replace function public._checkin_session(_token uuid)
returns public.attendance_sessions
language sql
security definer
set search_path = public
stable
as $$
  select * from public.attendance_sessions
  where checkin_token = _token and status = 'open'
  limit 1;
$$;

-- ---------- 세션 정보(유효성 확인용) ----------
create or replace function public.checkin_session_info(_token uuid)
returns table (club_name text, session_date date, valid boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.attendance_sessions;
  c public.clubs;
begin
  s := public._checkin_session(_token);
  if s.id is null then
    return query select null::text, null::date, false;
    return;
  end if;
  select * into c from public.clubs where id = s.club_id;
  return query select c.name, s.session_date, true;
end;
$$;

-- ---------- 회원 이름 검색 (출석여부 포함) ----------
create or replace function public.checkin_search_members(_token uuid, _q text)
returns table (
  id uuid,
  name text,
  gender member_gender,
  level smallint,
  attended boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.attendance_sessions;
begin
  s := public._checkin_session(_token);
  if s.id is null then
    raise exception 'invalid token';
  end if;
  if _q is null or length(trim(_q)) < 1 then
    return; -- 검색어 없으면 빈 결과
  end if;

  return query
  select m.id, m.name, m.gender, m.level,
         exists(
           select 1 from public.attendance_records ar
           where ar.session_id = s.id and ar.member_id = m.id
         ) as attended
  from public.club_members m
  where m.club_id = s.club_id
    and m.deleted_at is null
    and m.name ilike '%' || trim(_q) || '%'
  order by m.name
  limit 20;
end;
$$;

-- ---------- 회원 출석 ----------
create or replace function public.checkin_member(_token uuid, _member_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.attendance_sessions;
  m public.club_members;
begin
  s := public._checkin_session(_token);
  if s.id is null then
    raise exception 'invalid token';
  end if;

  select * into m from public.club_members
  where id = _member_id and club_id = s.club_id and deleted_at is null;
  if m.id is null then
    raise exception 'member not found';
  end if;

  -- 이미 출석했으면 그대로 성공 처리(멱등)
  if exists (
    select 1 from public.attendance_records
    where session_id = s.id and member_id = _member_id
  ) then
    return m.name;
  end if;

  insert into public.attendance_records (session_id, club_id, member_id, is_guest)
  values (s.id, s.club_id, _member_id, false);

  return m.name;
end;
$$;

-- ---------- 신규 회원 등록 + 출석 ----------
create or replace function public.checkin_new_member(
  _token uuid, _name text, _gender member_gender, _level smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.attendance_sessions;
  new_id uuid;
begin
  s := public._checkin_session(_token);
  if s.id is null then
    raise exception 'invalid token';
  end if;
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'name required';
  end if;
  if _level is not null and (_level < 1 or _level > 7) then
    _level := null;
  end if;

  insert into public.club_members (club_id, name, gender, level)
  values (s.club_id, trim(_name), _gender, _level)
  returning id into new_id;

  insert into public.attendance_records (session_id, club_id, member_id, is_guest)
  values (s.id, s.club_id, new_id, false);

  return trim(_name);
end;
$$;

-- ---------- 게스트 출석 ----------
create or replace function public.checkin_guest(
  _token uuid, _name text, _gender member_gender, _level smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.attendance_sessions;
begin
  s := public._checkin_session(_token);
  if s.id is null then
    raise exception 'invalid token';
  end if;
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'name required';
  end if;
  if _level is not null and (_level < 1 or _level > 7) then
    _level := null;
  end if;

  insert into public.attendance_records
    (session_id, club_id, member_id, guest_name, guest_gender, guest_level, is_guest)
  values
    (s.id, s.club_id, null, trim(_name), _gender, _level, true);

  return trim(_name);
end;
$$;

-- ---------- 익명(anon) 실행 권한 부여 ----------
grant execute on function public.checkin_session_info(uuid)            to anon, authenticated;
grant execute on function public.checkin_search_members(uuid, text)    to anon, authenticated;
grant execute on function public.checkin_member(uuid, uuid)            to anon, authenticated;
grant execute on function public.checkin_new_member(uuid, text, member_gender, smallint) to anon, authenticated;
grant execute on function public.checkin_guest(uuid, text, member_gender, smallint)      to anon, authenticated;
-- 내부 헬퍼는 직접 노출하지 않음(안전을 위해 권한 회수)
revoke execute on function public._checkin_session(uuid) from anon, authenticated;
