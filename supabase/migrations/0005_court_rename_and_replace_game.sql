-- =============================================================
-- 0005: 코트 이름 변경 + 진행 중 게임 멤버/종류 교체 RPC
-- =============================================================

-- 진행 중 게임의 참가자를 통째로 교체한다(멤버 변경 + 인원수 변경=종류 변경).
-- 기존 참가자 삭제 후 새 참가자 insert. 일반 모드라 team=1 고정.
-- 다른 게임과의 중복 배정은 uq_active_player 인덱스가 차단.
create or replace function public.replace_game_players(
  _game_id uuid,
  _players uuid[]   -- attendance_record_id 배열 (2 또는 4명)
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  g public.games;
  rec uuid;
begin
  select club_id into _club_id from public.games
  where id = _game_id and status = 'ongoing';

  if _club_id is null then
    raise exception 'game not ongoing';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;
  if array_length(_players, 1) is null or array_length(_players, 1) < 2 then
    raise exception 'need at least 2 players';
  end if;

  -- 기존 참가자 제거 후 재삽입 (활성 유니크 인덱스 충돌 방지를 위해 먼저 삭제)
  delete from public.game_players where game_id = _game_id;

  foreach rec in array _players loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (_game_id, _club_id, rec, 1, true);
  end loop;

  select * into g from public.games where id = _game_id;
  return g;
end;
$$;
