import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // 단위 테스트만 — e2e/*.spec.ts(Playwright)는 vitest가 잡지 않도록 한다.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
