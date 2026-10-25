import { z } from 'zod';

const EnvSchema = z.object({
  SUPERCELL_API_KEY: z.string().optional(),
  SUPERCELL_API_BASE: z.string().url().default('https://api.brawlstars.com/v1'),
  SUPERCELL_MOCK: z.enum(['0', '1']).default('0'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3200'),
  ADMIN_DISCORD_IDS: z.string().default(''),
  AUTH_MOCK: z.enum(['0', '1']).default('0'),
  AUTH_MOCK_ADMIN: z.enum(['0', '1']).default('0'),
  NODE_ENV: z.string().default('development'),
});

export interface Config {
  supercellApiKey: string | null;
  supercellApiBase: string;
  supercellMock: boolean;
  host: string;
  port: number;
  redisUrl: string | null;
  logLevel: string;
  databaseUrl: string | null;
  discordClientId: string | null;
  discordClientSecret: string | null;
  publicSiteUrl: string;
  adminDiscordIds: string[];
  authMock: boolean;
  authMockAdmin: boolean;
  nodeEnv: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const present = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const e = EnvSchema.parse(present);
  const mock = e.SUPERCELL_MOCK === '1';
  if (!mock && !e.SUPERCELL_API_KEY) {
    throw new Error(
      'Falta SUPERCELL_API_KEY en apps/api/.env (o usa SUPERCELL_MOCK=1 para trabajar con fixtures).',
    );
  }
  const authMock = e.AUTH_MOCK === '1';
  if (authMock && e.NODE_ENV === 'production') {
    throw new Error('AUTH_MOCK=1 no está permitido con NODE_ENV=production.');
  }
  if (e.DATABASE_URL && !authMock) {
    for (const key of ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'] as const) {
      if (!e[key]) throw new Error(`Falta ${key} en apps/api/.env (o usa AUTH_MOCK=1 en desarrollo).`);
    }
  }
  return {
    supercellApiKey: e.SUPERCELL_API_KEY ?? null,
    supercellApiBase: e.SUPERCELL_API_BASE,
    supercellMock: mock,
    host: e.HOST,
    port: e.PORT,
    redisUrl: e.REDIS_URL ?? null,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL ?? null,
    discordClientId: e.DISCORD_CLIENT_ID ?? null,
    discordClientSecret: e.DISCORD_CLIENT_SECRET ?? null,
    publicSiteUrl: e.PUBLIC_SITE_URL,
    adminDiscordIds: e.ADMIN_DISCORD_IDS.split(',').map((id) => id.trim()).filter(Boolean),
    authMock,
    authMockAdmin: e.AUTH_MOCK_ADMIN === '1',
    nodeEnv: e.NODE_ENV,
  };
}
