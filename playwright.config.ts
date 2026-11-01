import { defineConfig, devices } from '@playwright/test'

/**
 * Browser end-to-end tests. The site is built in demo mode (no Supabase: sample data) and served
 * by `vite preview`. Locally the tests use headless Microsoft Edge; on GitHub Actions Chromium
 * (same engine). Usage: npm run test:e2e
 */
const browser = process.env.CI ? { channel: undefined } : { channel: 'msedge' }

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    ...browser,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...browser } },
    { name: 'phone', use: { ...devices['Pixel 7'], ...browser } },
  ],
  webServer: {
    // Demo mode: no Supabase keys in this build.
    command: 'npx vite build --mode e2e && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
