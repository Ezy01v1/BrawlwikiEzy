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
});
