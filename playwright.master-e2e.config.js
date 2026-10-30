import { defineConfig } from '@playwright/test';

// Phase 9 master isolated UI matrix. This does not claim real Safari, physical device,
// actual OAuth provider, or live Production E2E verification.
const browser = process.env.CHATGUN_TEST_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browser)) {
  throw new Error('Unsupported master E2E browser');
}
const viewports = [
  [320, 720], [360, 800], [390, 844], [430, 932],
  [768, 1024], [1024, 900], [1440, 900], [1920, 1080],
];

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['auth.spec.js', 'social.spec.js', 'moderation.spec.js'],
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['json', {outputFile: 'test-results/master-' + browser + '.json'}]],
  use: {
    baseURL: 'https://localhost:8797',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: viewports.map(([width,height]) => ({
    name: browser + '-' + width,
    use: {browserName: browser, viewport: {width,height}},
  })),
  outputDir: 'test-results/master-' + browser,
  webServer: {
    command: 'node scripts/serve-issue16-local.mjs',
    url: 'https://localhost:8797/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
