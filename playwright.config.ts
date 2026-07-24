import { defineConfig, devices } from "@playwright/test";

/**
 * The repeatable layer (MASTER-PLAN Appendix B3).
 * Headless proves the logic; the live browser pass proves the product.
 * The committee requires BOTH.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One local retry absorbs `next dev` JIT-compile stalls under full-suite
  // parallel load (a transient `page.reload` navigation timeout, not a product
  // bug — every test passes when run isolated). CI keeps 2. The acceptance
  // criteria themselves are deterministic; this only de-flakes the dev server.
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The worst-day proxy: 11:40pm, 4% battery, a phone.
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
