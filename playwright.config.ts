import { defineConfig } from '@playwright/test'

const port = Number(process.env.MANIFEST_TEST_PORT ?? 4187)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
})
