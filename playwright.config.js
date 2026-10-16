import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Live Preview tests share three explicitly synthetic D1 accounts. A single worker keeps
  // desktop/mobile projects from racing relationship and deletion mutations.
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://codex-chatgun-release-candid.chatgun.pages.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
