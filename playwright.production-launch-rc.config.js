import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-launch-rc.spec.js',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/production-launch-rc.json' }]],
  use: { baseURL: 'https://localhost:8797', ignoreHTTPSErrors: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'CHATGUN_FULL_SYSTEM_LOCAL=true CHATGUN_LAUNCH_RC=true node scripts/serve-issue16-local.mjs',
    url: 'https://localhost:8797/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
