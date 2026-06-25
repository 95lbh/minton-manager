import { test, expect } from "@playwright/test";

/**
 * 운영 골든패스 스모크:
 *   비회원 시작 → 클럽 생성 → 대시보드 → 샘플 데이터 →
 *   출석 체크 → 코트 자동 배정 → 게임 시작.
 * 이 경로가 살아 있으면 익명 인증·create_club RPC·출석·코트 배정 알고리즘·
 * start_game RPC·가드/레이아웃·실시간까지 핵심 흐름이 정상.
 *
 * ⚠️ 실제 Supabase(.env.local)에 익명 사용자 + 임시 클럽/출석/게임을 만든다.
 *    임시 클럽은 정리 cron(7일)으로 자동 삭제됨. 가능하면 별도 테스트 프로젝트 권장.
 *    실행: npx playwright install chromium (최초) → npm run test:e2e
 */
test("비회원 시작 → 출석 → 코트 배정 → 게임 시작", async ({ page }) => {
  await page.goto("/");

  // 랜딩: "비회원으로 바로 시작"
  await page.getByRole("button", { name: "비회원으로 바로 시작" }).click();

  // 온보딩: 클럽 이름 입력 → 만들기
  const nameInput = page.getByLabel("클럽 이름");
  await expect(nameInput).toBeVisible({ timeout: 20_000 });
  await nameInput.fill(`E2E 스모크 ${Date.now()}`);
  await page.getByRole("button", { name: "클럽 만들기" }).click();

  // 대시보드 도착 확인
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "대시보드" }),
  ).toBeVisible();

  // 신규(빈) 클럽: 시작 가이드 + 샘플 데이터 둘러보기 노출
  await expect(
    page.getByRole("heading", { name: "시작 가이드" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /샘플 데이터로 먼저 둘러보기/ }).click();

  // 샘플 회원이 회원 목록에 채워졌는지 확인
  await page.goto("/members");
  await expect(
    page.getByRole("heading", { name: "회원 관리" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("김민준")).toBeVisible({ timeout: 20_000 });

  // ── 출석 체크: 샘플 회원 4명 ──
  await page.goto("/attendance");
  await expect(
    page.getByRole("heading", { name: "출석 관리" }),
  ).toBeVisible({ timeout: 20_000 });
  for (const name of ["김민준", "이서연", "박도윤", "최지우"]) {
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
  }
  await expect(page.getByText("출석한 사람 (4)")).toBeVisible({
    timeout: 20_000,
  });

  // ── 코트/게임: 대기열 확인 → 자동 배정으로 게임 시작 ──
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { name: "코트 현황" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/대기 4명/)).toBeVisible({ timeout: 20_000 });

  // 첫 코트의 "자동 배정" → 추천 → 시작
  await page.getByRole("button", { name: "자동 배정", exact: true }).first().click();
  await page.getByRole("button", { name: /자동 배정 추천/ }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  // 게임이 시작되면 진행 중 카드에 "종료" 버튼이 나타난다.
  await expect(
    page.getByRole("button", { name: "종료" }).first(),
  ).toBeVisible({ timeout: 20_000 });
});
