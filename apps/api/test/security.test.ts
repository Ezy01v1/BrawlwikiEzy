import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger';
import { createSupercellClient } from '../src/supercell/client';
import { createTestApp, fakeFetch } from './helpers';

const KEY = 'eyJ0eXAi.clave-super-secreta.123';

describe('la API key nunca se filtra', () => {
  it('ni en la respuesta ni en los logs cuando Supercell rechaza la key (403)', async () => {
    const lines: string[] = [];
    const logger = createLogger('trace', { write: (s: string) => void lines.push(s) });
    const f = fakeFetch([{ status: 403, body: { reason: 'accessDenied.invalidIp', message: 'Invalid authorization' } }]);
    const supercell = createSupercellClient({ apiKey: KEY, baseUrl: 'https://api.test/v1', fetchImpl: f.impl, logger });
    const { app } = createTestApp({ supercell, app: { logger } });

    const res = await request(app).get('/api/v1/players/2PP');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain(KEY);
    expect(JSON.stringify(res.headers)).not.toContain(KEY);
    const logs = lines.join('\n');
    expect(logs).toContain('IP no autorizada');
    expect(logs).not.toContain(KEY);
  });
});
