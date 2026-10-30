import { defineConfig } from '@playwright/test';

const heights = { 360: 800, 390: 844, 430: 932, 768: 1024, 1024: 900, 1440: 900 };

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['auth.spec.js', 'social.spec.js', 'moderation.spec.js'],
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['json', { outputFile: 'docs/production-readiness/phase7/responsive-playwright.json' }]],
  use: {
    baseURL: 'https://localhost:8797',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: Object.entries(heights).map(([width, height]) => ({
    name: `chromium-${width}`,
    use: { browserName: 'chromium', viewport: { width: Number(width), height } },
  })),
  outputDir: 'test-results/phase7-responsive',
  webServer: {
    command: 'node scripts/serve-issue16-local.mjs',
    url: 'https://localhost:8797/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
