import { defineConfig, devices } from "@playwright/test";

/**
 * E2E(Playwright) 설정 — 핵심 플로우 스모크 테스트.
 *  - testDir: ./e2e (단위 테스트 vitest 와 분리)
 *  - webServer: 로컬 dev 서버를 자동 기동(이미 떠 있으면 재사용)
 *  - .env.local 의 Supabase 환경이 필요(dev 서버가 로드).
 *
 * 실행: npx playwright install chromium  (최초 1회)  →  npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
