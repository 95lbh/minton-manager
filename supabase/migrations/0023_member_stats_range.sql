-- =============================================================
-- 0023: 기간별 회원 참여 통계 (통계 기간 필터)
--  - member_stats 뷰는 누적(전체)만 제공 → 기간([_from,_to]) 집계 함수 추가.
--  - session_date 기준으로 출석/게임을 범위 제한. 취소 게임은 제외.
--  - security invoker: 호출자(서버=사용자 세션)의 RLS가 그대로 적용된다.
-- =============================================================

create or replace function public.member_stats_range(
  _club_id uuid,
  _from date,
  _to date
)
returns table (
  member_id uuid,
  name text,
  gender member_gender,
  level smallint,
  birth_year smallint,
  attend_cnt bigint,
  game_cnt bigint,
  last_played_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.name,
    m.gender,
    m.level,
    m.birth_year,
    count(distinct s.id) as attend_cnt,
    count(distinct gp.game_id)
      filter (where s.id is not null and g.status is distinct from 'canceled') as game_cnt,
    max(g.started_at)
      filter (where s.id is not null and g.status is distinct from 'canceled') as last_played_at
  from public.club_members m
  left join public.attendance_records ar on ar.member_id = m.id
  left join public.attendance_sessions s
    on s.id = ar.session_id and s.session_date between _from and _to
  left join public.game_players gp on gp.attendance_record_id = ar.id
  left join public.games g on g.id = gp.game_id
  where m.club_id = _club_id and m.deleted_at is null
  group by m.id, m.name, m.gender, m.level, m.birth_year;
$$;

grant execute on function public.member_stats_range(uuid, date, date) to authenticated;
