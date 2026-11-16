import { defineConfig, devices } from '@playwright/test';
// Opt-in only. No browser installation or launch is part of npm test/build/CI.
export default defineConfig({
  testDir: './tests',
  testMatch: ['visual/**/*.spec.ts', 'interaction/**/*.spec.ts', 'performance/**/*.spec.ts'],
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/visual/baselines/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-dpr2', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
