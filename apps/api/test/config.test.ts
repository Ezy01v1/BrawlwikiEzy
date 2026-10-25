import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('aplica valores por defecto', () => {
    const c = loadConfig({ SUPERCELL_API_KEY: 'k' });
    expect(c).toEqual({
      supercellApiKey: 'k',
      supercellApiBase: 'https://api.brawlstars.com/v1',
      supercellMock: false,
      host: '127.0.0.1',
      port: 4000,
      redisUrl: null,
      logLevel: 'info',
      databaseUrl: null,
      discordClientId: null,
      discordClientSecret: null,
      publicSiteUrl: 'http://localhost:3200',
      adminDiscordIds: [],
      authMock: false,
      authMockAdmin: false,
      nodeEnv: 'development',
    });
  });

  it('exige la key si no está en modo mock', () => {
    expect(() => loadConfig({})).toThrow('Falta SUPERCELL_API_KEY');
  });

  it('permite arrancar sin key en modo mock y trata strings vacíos como ausentes', () => {
    const c = loadConfig({ SUPERCELL_MOCK: '1', SUPERCELL_API_KEY: '', REDIS_URL: '' });
    expect(c.supercellMock).toBe(true);
    expect(c.supercellApiKey).toBeNull();
    expect(c.redisUrl).toBeNull();
  });

  it('rechaza AUTH_MOCK=1 en producción', () => {
    expect(() => loadConfig({ SUPERCELL_MOCK: '1', AUTH_MOCK: '1', NODE_ENV: 'production' })).toThrow('AUTH_MOCK');
  });

  it('exige credenciales de Discord con DATABASE_URL y sin AUTH_MOCK', () => {
    expect(() => loadConfig({ SUPERCELL_MOCK: '1', DATABASE_URL: 'mysql://x' })).toThrow('DISCORD_CLIENT_ID');
    expect(() =>
      loadConfig({ SUPERCELL_MOCK: '1', DATABASE_URL: 'mysql://x', DISCORD_CLIENT_ID: 'a' }),
    ).toThrow('DISCORD_CLIENT_SECRET');
    expect(loadConfig({ SUPERCELL_MOCK: '1', DATABASE_URL: 'mysql://x', AUTH_MOCK: '1' }).authMock).toBe(true);
  });

  it('parsea ADMIN_DISCORD_IDS', () => {
    expect(loadConfig({ SUPERCELL_MOCK: '1', ADMIN_DISCORD_IDS: ' 1, 2 ' }).adminDiscordIds).toEqual(['1', '2']);
  });
});
