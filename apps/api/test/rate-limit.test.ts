import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createUpstreamGuard } from '../src/http/rate-limit';
import { createTestApp } from './helpers';

describe('createUpstreamGuard', () => {
  it('permite perMinute llamadas por clave en 60s y luego lanza RATE_LIMITED con retryAfter', () => {
    let t = 0;
    const g = createUpstreamGuard({ perMinute: 3, now: () => t });
    g.check('a');
    t = 10_000;
    g.check('a');
    g.check('a');
    expect(() => g.check('a')).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfter: 50 }));
    expect(() => g.check('b')).not.toThrow();
    t = 60_000;
    expect(() => g.check('a')).not.toThrow();
  });
});

const IP_A = '203.0.113.5';
const IP_B = '198.51.100.7';

describe('limitador general', () => {
  it('429 al superar el límite por IP; otra IP y /health no se ven afectadas', async () => {
    const { app } = createTestApp({ app: { rateLimit: { generalPerMinute: 3, upstreamPerMinute: 100 } } });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_A)).status).toBe(200);
    }
    const blocked = await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_A);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error.requestId).toBe(blocked.headers['x-request-id']);

    expect((await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_B)).status).toBe(200);
    expect((await request(app).get('/api/v1/health').set('X-Forwarded-For', IP_A)).status).toBe(200);
  });
});

describe('guardia upstream por IP', () => {
  it('solo cuentan las consultas que llegan a Supercell', async () => {
    const { app } = createTestApp({ app: { rateLimit: { generalPerMinute: 100, upstreamPerMinute: 2 } } });
    const get = (path: string, ip = IP_A) => request(app).get(path).set('X-Forwarded-For', ip);

    expect((await get('/api/v1/players/2PP')).status).toBe(200); // upstream 1
    expect((await get('/api/v1/players/2PP')).headers['x-cache-status']).toBe('HIT'); // no cuenta
    expect((await get('/api/v1/clubs/2YPLQ')).status).toBe(200); // upstream 2
    const blocked = await get('/api/v1/clubs/8CGRV');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await get('/api/v1/clubs/8CGRV', IP_B)).status).toBe(200);
  });
});
