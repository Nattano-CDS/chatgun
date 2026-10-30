import { defineConfig } from '@playwright/test';

// Isolated WebKit simulation only. This is NOT physical iOS/Safari evidence.
const sizes = [
  { name: 'webkit-mobile-390', width: 390, height: 844, isMobile: true },
  { name: 'webkit-tablet-768', width: 768, height: 1024, isMobile: true },
  { name: 'webkit-desktop-1440', width: 1440, height: 900, isMobile: false },
];

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['auth.spec.js', 'social.spec.js', 'moderation.spec.js'],
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/phase8-webkit-results.json' }]],
  use: {
    baseURL: 'https://localhost:8797',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: sizes.map(({name, width, height, isMobile}) => ({
    name,
    use: { browserName: 'webkit', viewport: { width, height }, isMobile, hasTouch: isMobile },
  })),
  outputDir: 'test-results/phase8-webkit',
  webServer: {
    command: 'node scripts/serve-issue16-local.mjs',
    url: 'https://localhost:8797/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
