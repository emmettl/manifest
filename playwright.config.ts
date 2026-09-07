import { defineConfig } from '@playwright/test'

const port = Number(process.env.MANIFEST_TEST_PORT ?? 4187)
const reviewPort = port + 1

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', contextOptions: { reducedMotion: 'reduce' }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'public', testIgnore: '**/noaa-review.pw.ts' },
    { name: 'local-review', testMatch: '**/noaa-review.pw.ts', use: { baseURL: `http://127.0.0.1:${reviewPort}` } },
  ],
  webServer: [
    { command: `npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
    { command: `npm run dev -- --port ${reviewPort} --strictPort`, url: `http://127.0.0.1:${reviewPort}`, reuseExistingServer: !process.env.CI },
  ],
})
