-- =============================================================
-- 클럽 생성 RPC (clubs + club_admins 를 한 트랜잭션으로)
-- 클럽 insert 후 owner 를 admin 으로 등록. 둘 중 하나라도 실패하면 롤백.
-- =============================================================
create or replace function public.create_club(
  _name text,
  _is_temporary boolean default false
)
returns public.clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  new_club public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'club name required';
  end if;

  insert into public.clubs (name, owner_id, is_temporary)
  values (trim(_name), auth.uid(), _is_temporary)
  returning * into new_club;

  insert into public.club_admins (club_id, user_id, role)
  values (new_club.id, auth.uid(), 'admin');

  return new_club;
end;
$$;
