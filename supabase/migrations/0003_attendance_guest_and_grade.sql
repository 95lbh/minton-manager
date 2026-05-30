-- =============================================================
-- 0003: 게스트 출석에 성별/실력 추가 + 실력 등급 범위 확장(1~7, S~F)
-- =============================================================

-- 게스트도 성별/실력을 입력받기 위해 컬럼 추가
alter table public.attendance_records
  add column if not exists guest_gender member_gender,
  add column if not exists guest_level  smallint;

-- (참고) club_members.level 은 smallint 라 별도 제약이 없으면 1~7도 그대로 저장 가능.
-- 명시적 체크 제약이 있었다면 여기서 갱신했겠지만, 0001 에는 범위 제약이 없어 변경 불필요.
