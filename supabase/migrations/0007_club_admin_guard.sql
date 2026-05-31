-- =============================================================
-- 0007: 공동 관리자 관리 + 권한 안전장치 + 임시 클럽 정리
--  - club_admins 변경(insert/update/delete)을 소유자(owner)로 제한
--    (공동 관리자가 소유자/다른 admin을 건드리지 못하게)
--  - list_club_admins: 클럽 관리자 목록(프로필 조인) — 멤버만
--  - remove_club_admin: 소유자가 공동 관리자 내보내기 (owner 본인 제외)
--  - cleanup_temporary_clubs: 오래된 비회원 임시 클럽 정리(스케줄러 전용)
-- 보안: club_admins insert는 create_club / join_club_by_code(둘 다 SECURITY DEFINER)가
--       처리하므로 RLS를 소유자-only로 좁혀도 정상 동작(정의자 함수는 RLS 우회).
-- =============================================================

-- 1) club_admins 변경 정책을 소유자 전용으로 강화 ---------------------------
drop policy if exists "club_admins insert" on public.club_admins;
drop policy if exists "club_admins modify" on public.club_admins;
drop policy if exists "club_admins delete" on public.club_admins;

-- insert: 소유자만 (참여는 join_club_by_code RPC가 정의자 권한으로 처리)
create policy "club_admins insert" on public.club_admins for insert
  with check (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- update(역할 변경 등): 소유자만
create policy "club_admins modify" on public.club_admins for update
  using (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- delete: 소유자가 (owner 본인 행 제외) 내보내거나, 비소유자 본인이 탈퇴
create policy "club_admins delete" on public.club_admins for delete using (
  user_id <> (select owner_id from public.clubs where id = club_id)
  and (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
    or user_id = auth.uid()
  )
);

-- 2) 클럽 관리자 목록(프로필 조인) — 호출자가 멤버일 때만 -----------------
-- profiles는 본인 행만 조회 가능(RLS)하므로, 멤버 검증 후 정의자 권한으로 조인.
create or replace function public.list_club_admins(_club_id uuid)
returns table (
  user_id uuid,
  role club_role,
  display_name text,
  email text,
  is_owner boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ca.user_id,
    ca.role,
    p.display_name,
    p.email,
    (c.owner_id = ca.user_id) as is_owner
  from public.club_admins ca
  join public.clubs c on c.id = ca.club_id
  left join public.profiles p on p.id = ca.user_id
  where ca.club_id = _club_id
    and public.is_club_member(_club_id)
  order by (c.owner_id = ca.user_id) desc, ca.created_at;
$$;

-- 3) 공동 관리자 내보내기 — 소유자만, owner 본인은 제거 불가 ----------------
create or replace function public.remove_club_admin(_club_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clubs where id = _club_id and owner_id = auth.uid()
  ) then
    raise exception 'only owner can remove admins';
  end if;

  if _user_id = (select owner_id from public.clubs where id = _club_id) then
    raise exception 'cannot remove owner';
  end if;

  delete from public.club_admins where club_id = _club_id and user_id = _user_id;
end;
$$;

-- 4) 임시 클럽 정리 — 비회원 임시 클럽이 _days일간 활동 없으면 soft delete ----
-- 활동 기준: 마지막 출석 세션 날짜(없으면 생성일).
-- 스케줄러(service_role/pg_cron)에서만 호출 — authenticated에 권한 부여하지 않음.
create or replace function public.cleanup_temporary_clubs(_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with stale as (
    select c.id
    from public.clubs c
    where c.is_temporary = true
      and c.deleted_at is null
      and coalesce(
        (select max(s.session_date)::timestamptz
           from public.attendance_sessions s where s.club_id = c.id),
        c.created_at
      ) < now() - make_interval(days => _days)
  )
  update public.clubs set deleted_at = now()
  where id in (select id from stale);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 5) 실행 권한 (로그인 사용자) — cleanup은 부여하지 않음(스케줄러 전용)
grant execute on function public.list_club_admins(uuid) to authenticated;
grant execute on function public.remove_club_admin(uuid, uuid) to authenticated;
