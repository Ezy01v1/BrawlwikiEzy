import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * Comunidad en los E2E: solo con TEST_DATABASE_URL (un servidor MySQL sin base, como en los tests de la API).
 * Los E2E usan una base propia, `bw_test_e2e` (entra en el permiso `bw\_test\_%` del usuario local de tests), que se
 * borra, se crea y se migra en el `command` de la API: Playwright arranca los webServer antes que un globalSetup.
 * Sin la variable, la API corre como la v1 (DATABASE_URL vacía pisa la de apps/api/.env) y community.spec.ts se omite.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

function e2eDatabaseUrl(base: string): string {
  const url = new URL(base);
  url.pathname = '/bw_test_e2e';
  return url.toString();
}

const communityEnv: Record<string, string> = TEST_DATABASE_URL
  ? { DATABASE_URL: e2eDatabaseUrl(TEST_DATABASE_URL), AUTH_MOCK: '1', AUTH_MOCK_ADMIN: '1' }
  : { DATABASE_URL: '' };

const startApi = 'npm run start -w @brawlwiki/api';

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
      testIgnore: /(cooldown|community)\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    {
      // Todos los tests comparten una base y un único MockUser: en orden y de a uno (el primero abre la temporada).
      name: 'community',
      testMatch: /community\.spec\.ts/,
      fullyParallel: false,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    {
      // RRRR activa un cooldown global de 10 s en la API: corre al final, solo.
      name: 'cooldown',
      testMatch: /cooldown\.spec\.ts/,
      dependencies: ['main', 'community'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: TEST_DATABASE_URL
        ? `node apps/web/e2e/prepare-db.ts && npm run db:migrate -w @brawlwiki/api && ${startApi}`
        : startApi,
      cwd: '../..',
      url: `${API_URL}/health`,
      // Las variables del entorno tienen prioridad sobre apps/api/.env (process.loadEnvFile no las pisa).
      env: {
        SUPERCELL_MOCK: '1',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        REDIS_URL: '',
        // El Origin que manda la web E2E; si no coincide, la API responde 403 a las mutaciones.
        PUBLIC_SITE_URL: WEB_URL,
        ...communityEnv,
      },
      reuseExistingServer: false,
      // Con MySQL suma el DROP/CREATE y las migraciones antes de arrancar.
      timeout: TEST_DATABASE_URL ? 90_000 : 30_000,
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
