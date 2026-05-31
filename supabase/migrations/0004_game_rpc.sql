-- =============================================================
-- 0004: 게임 시작/종료 RPC (정합성 보장)
-- =============================================================

-- 게임 시작: games insert + game_players(team1/team2) 일괄 insert 를 한 트랜잭션으로.
-- 코트에 진행 중 게임이 있으면 거부. 중복 배정은 uq_active_player 인덱스가 DB 레벨에서 차단.
create or replace function public.start_game(
  _session_id uuid,
  _court_id   uuid,
  _team1      uuid[],   -- attendance_record_id 배열
  _team2      uuid[]
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  new_game public.games;
  rec uuid;
begin
  -- 세션에서 club_id 조회 + 권한 확인
  select club_id into _club_id
  from public.attendance_sessions
  where id = _session_id;

  if _club_id is null then
    raise exception 'session not found';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;

  -- 코트에 진행 중 게임이 있으면 거부
  if exists (
    select 1 from public.games
    where court_id = _court_id and status = 'ongoing'
  ) then
    raise exception 'court busy';
  end if;

  insert into public.games (club_id, session_id, court_id, status, created_by)
  values (_club_id, _session_id, _court_id, 'ongoing', auth.uid())
  returning * into new_game;

  foreach rec in array _team1 loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (new_game.id, _club_id, rec, 1, true);
  end loop;

  foreach rec in array _team2 loop
    insert into public.game_players (game_id, club_id, attendance_record_id, team, is_active)
    values (new_game.id, _club_id, rec, 2, true);
  end loop;

  return new_game;
end;
$$;

-- 게임 종료: status=finished (트리거 trg_deactivate_players 가 game_players.is_active=false 처리)
create or replace function public.end_game(_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id uuid;
  upd public.games;
begin
  select club_id into _club_id from public.games where id = _game_id;
  if _club_id is null then
    raise exception 'game not found';
  end if;
  if not public.is_club_member(_club_id) then
    raise exception 'forbidden';
  end if;

  update public.games
    set status = 'finished', ended_at = now()
    where id = _game_id and status = 'ongoing'
    returning * into upd;

  if upd.id is null then
    raise exception 'game not ongoing';
  end if;

  return upd;
end;
$$;
