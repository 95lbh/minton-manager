-- =============================================================
-- 0016: 클럽 소유권 이임 (transfer ownership)
-- -------------------------------------------------------------
-- 소유자(super admin)가 기존 공동 관리자(공유 코드로 초대된 운영자) 중 한 명에게
-- 클럽 소유권을 넘긴다. 이임 후:
--   - 대상 → 새 소유자(clubs.owner_id), 역할 admin 보장
--   - 이전 소유자 → club_admins 의 admin 행이 그대로 남아 '일반 운영자(공동 관리자)'가 됨
--
-- 보안: club_admins/clubs 변경은 소유자-only RLS(0007)로 막혀 있으므로
--       SECURITY DEFINER 로 처리하되, "현재 소유자 본인" 검증을 게이트로 둔다.
--       임시(비회원) 클럽은 공유/이임 불가.
-- ⚠️ Supabase SQL Editor(postgres 권한)에서 실행한다.
-- =============================================================

create or replace function public.transfer_club_ownership(
  _club_id uuid,
  _user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) 현재 소유자 본인만 가능
  if not exists (
    select 1 from public.clubs
     where id = _club_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'only owner can transfer ownership';
  end if;

  -- 2) 자기 자신에게는 이임 불가
  if _user_id = auth.uid() then
    raise exception 'cannot transfer to self';
  end if;

  -- 3) 임시(비회원) 클럽은 이임 불가
  if exists (
    select 1 from public.clubs where id = _club_id and is_temporary
  ) then
    raise exception 'cannot transfer temporary club';
  end if;

  -- 4) 대상은 이 클럽의 관리자(공유 코드로 초대된 멤버)여야 함
  if not exists (
    select 1 from public.club_admins
     where club_id = _club_id and user_id = _user_id
  ) then
    raise exception 'target is not a club admin';
  end if;

  -- 5) 소유권 이전
  update public.clubs set owner_id = _user_id where id = _club_id;

  -- 6) 새 소유자 역할 admin 보장(혹시 staff 였다면 승격)
  update public.club_admins set role = 'admin'
   where club_id = _club_id and user_id = _user_id;

  -- 7) 이전 소유자는 admin 공동 관리자로 잔류(정상 흐름엔 행이 이미 존재).
  insert into public.club_admins (club_id, user_id, role)
  values (_club_id, auth.uid(), 'admin')
  on conflict (club_id, user_id) do update set role = 'admin';
end;
$$;

grant execute on function public.transfer_club_ownership(uuid, uuid) to authenticated;
