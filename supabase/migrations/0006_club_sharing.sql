-- =============================================================
-- 0006: 클럽 공유(공동 관리자)
--  - clubs.join_code: 클럽당 단일 재생성 참여 코드
--  - 코드로 참여하면 본인을 공동 관리자(admin)로 등록
--  - 클럽 삭제(soft delete)는 최초 생성자(owner = super admin)만
-- 보안: 참여자는 아직 club 멤버가 아니라 RLS insert가 막히므로
--       join_club_by_code는 SECURITY DEFINER로 우회하되, "코드 검증"이 게이트.
--       삭제는 owner_id = auth.uid() 검증으로 일반 update 정책(멤버 허용)을 우회/강화.
-- =============================================================

-- 1) 참여 코드 컬럼 (단일, 재생성 가능). 추측 어려운 uuid.
alter table public.clubs
  add column if not exists join_code uuid not null default gen_random_uuid();

create unique index if not exists uq_clubs_join_code
  on public.clubs (join_code);

-- 2) 참여 코드 재생성 — 해당 클럽 admin 누구나. 새 코드 반환(이전 코드 무효화).
create or replace function public.regenerate_join_code(_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code uuid;
begin
  if not public.is_club_admin(_club_id) then
    raise exception 'not authorized';
  end if;

  update public.clubs
     set join_code = gen_random_uuid()
   where id = _club_id and deleted_at is null
  returning join_code into new_code;

  if new_code is null then
    raise exception 'club not found';
  end if;

  return new_code;
end;
$$;

-- 3) 코드로 클럽 참여 → 본인을 공동 관리자(admin)로 등록.
create or replace function public.join_club_by_code(_code uuid)
returns public.clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target
    from public.clubs
   where join_code = _code and deleted_at is null;

  if target.id is null then
    raise exception 'invalid code';
  end if;

  insert into public.club_admins (club_id, user_id, role)
  values (target.id, auth.uid(), 'admin')
  on conflict (club_id, user_id) do nothing;

  return target;
end;
$$;

-- 4) 클럽 삭제(soft delete) — owner(super admin)만 가능.
create or replace function public.delete_club(_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clubs
     where id = _club_id and owner_id = auth.uid()
  ) then
    raise exception 'only owner can delete';
  end if;

  update public.clubs set deleted_at = now() where id = _club_id;
end;
$$;

-- 5) 실행 권한 (로그인 사용자)
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.join_club_by_code(uuid) to authenticated;
grant execute on function public.delete_club(uuid) to authenticated;
