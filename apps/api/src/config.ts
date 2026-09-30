import { z } from 'zod';

const EnvSchema = z.object({
  SUPERCELL_API_KEY: z.string().optional(),
  SUPERCELL_API_BASE: z.string().url().default('https://api.brawlstars.com/v1'),
  SUPERCELL_MOCK: z.enum(['0', '1']).default('0'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export interface Config {
  supercellApiKey: string | null;
  supercellApiBase: string;
  supercellMock: boolean;
  host: string;
  port: number;
  redisUrl: string | null;
  logLevel: string;
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
  return {
    supercellApiKey: e.SUPERCELL_API_KEY ?? null,
    supercellApiBase: e.SUPERCELL_API_BASE,
    supercellMock: mock,
    host: e.HOST,
    port: e.PORT,
    redisUrl: e.REDIS_URL ?? null,
    logLevel: e.LOG_LEVEL,
  };
}
