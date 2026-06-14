import { test, expect } from "@playwright/test";

/**
 * 핵심 부트스트랩 스모크: 비회원 시작 → 온보딩 → 클럽 생성 → 대시보드.
 * 이 경로가 살아 있으면 익명 인증 · create_club RPC · 가드/레이아웃이 정상.
 *
 * ⚠️ 실제 Supabase(.env.local)에 익명 사용자 + 임시 클럽을 만든다.
 *    임시 클럽은 정리 cron(7일)으로 자동 삭제됨. 가능하면 별도 테스트 프로젝트 권장.
 */
test("비회원 시작 → 클럽 생성 → 대시보드 진입", async ({ page }) => {
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
});
