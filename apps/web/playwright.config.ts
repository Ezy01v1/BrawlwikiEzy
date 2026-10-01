import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: WEB_URL, locale: 'es-MX', trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /mock\.setup\.ts/ },
    {
      name: 'main',
      testIgnore: /cooldown\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    {
      // RRRR activa un cooldown global de 10 s en la API: corre al final, solo.
      name: 'cooldown',
      testMatch: /cooldown\.spec\.ts/,
      dependencies: ['main'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start -w @brawlwiki/api',
      cwd: '../..',
      url: `${API_URL}/health`,
      // Las variables del entorno tienen prioridad sobre apps/api/.env (process.loadEnvFile no las pisa).
      env: { SUPERCELL_MOCK: '1', HOST: '127.0.0.1', PORT: String(API_PORT), LOG_LEVEL: 'warn', REDIS_URL: '' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: WEB_URL,
      env: { API_INTERNAL_URL: API_URL, NEXT_PUBLIC_SITE_URL: WEB_URL },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
