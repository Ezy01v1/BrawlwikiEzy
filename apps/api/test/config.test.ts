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

  describe('PUBLIC_SITE_URL', () => {
    const base = { SUPERCELL_MOCK: '1' };
    const prod = {
      ...base,
      NODE_ENV: 'production',
      DATABASE_URL: 'mysql://x',
      DISCORD_CLIENT_ID: 'a',
      DISCORD_CLIENT_SECRET: 'b',
    };

    it('se normaliza a su origin (sin "/" final ni ruta): el redirect de Discord no queda con "//"', () => {
      expect(loadConfig({ ...base, PUBLIC_SITE_URL: 'https://brawlwiki.test/' }).publicSiteUrl).toBe(
        'https://brawlwiki.test',
      );
      expect(loadConfig({ ...base, PUBLIC_SITE_URL: 'https://brawlwiki.test/algo?x=1' }).publicSiteUrl).toBe(
        'https://brawlwiki.test',
      );
      expect(loadConfig({ ...base, PUBLIC_SITE_URL: 'http://localhost:3100/' }).publicSiteUrl).toBe(
        'http://localhost:3100',
      );
    });

    it('en desarrollo el default sigue siendo http://localhost:3200', () => {
      expect(loadConfig(base).publicSiteUrl).toBe('http://localhost:3200');
      expect(loadConfig({ ...base, DATABASE_URL: 'mysql://x', AUTH_MOCK: '1' }).publicSiteUrl).toBe(
        'http://localhost:3200',
      );
    });

    it('en producción con DATABASE_URL es obligatoria y https', () => {
      expect(() => loadConfig(prod)).toThrow('PUBLIC_SITE_URL');
      expect(() => loadConfig({ ...prod, PUBLIC_SITE_URL: 'http://brawlwiki.test' })).toThrow('https');
      expect(loadConfig({ ...prod, PUBLIC_SITE_URL: 'https://brawlwiki.test/' }).publicSiteUrl).toBe(
        'https://brawlwiki.test',
      );
      // Sin DATABASE_URL (la v1, sin Comunidad) no hace falta.
      expect(loadConfig({ ...base, NODE_ENV: 'production' }).publicSiteUrl).toBe('http://localhost:3200');
    });

    it('rechaza AUTH_MOCK=1 con un PUBLIC_SITE_URL https público (aunque falte NODE_ENV)', () => {
      expect(() => loadConfig({ ...base, AUTH_MOCK: '1', PUBLIC_SITE_URL: 'https://brawlwiki.test' })).toThrow(
        'AUTH_MOCK',
      );
      for (const local of ['http://localhost:3100', 'https://localhost:3200', 'https://127.0.0.1:8443', 'https://app.localhost']) {
        expect(loadConfig({ ...base, AUTH_MOCK: '1', PUBLIC_SITE_URL: local }).authMock, local).toBe(true);
      }
    });
  });

  it('parsea ADMIN_DISCORD_IDS', () => {
    expect(loadConfig({ SUPERCELL_MOCK: '1', ADMIN_DISCORD_IDS: ' 1, 2 ' }).adminDiscordIds).toEqual(['1', '2']);
  });
});
