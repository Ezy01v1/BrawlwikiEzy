import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../src/logger';
import { createSupercellClient } from '../src/supercell/client';
import { createLimiter } from '../src/supercell/limiter';
import { fakeFetch } from './helpers';

const BASE = 'https://api.test/v1';
const KEY = 'super-secret-key';

function client(f: ReturnType<typeof fakeFetch>, extra: Partial<Parameters<typeof createSupercellClient>[0]> = {}) {
  return createSupercellClient({ apiKey: KEY, baseUrl: BASE, fetchImpl: f.impl, retryDelayMs: 0, ...extra });
}

describe('createSupercellClient', () => {
  it('envía la key como Bearer y codifica el # del tag', async () => {
    const f = fakeFetch([{ status: 200, body: { tag: '#2PP' } }]);
    await client(f).getPlayer('2PP');
    expect(f.calls[0]!.url).toBe(`${BASE}/players/%232PP`);
    expect(new Headers(f.calls[0]!.init?.headers).get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('arma las rutas de rankings, brawlers y eventos', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { items: [] } }));
    const c = client(f);
    await c.getPlayerRankings('MX', 200);
    await c.getClubRankings('global', 200);
    await c.getBrawlerRankings('global', 16000000, 200);
    await c.getBrawlers();
    await c.getEventRotation();
    await c.getBattleLog('2PP');
    await c.getClub('2YPLQ');
    expect(f.calls.map((x) => x.url)).toEqual([
      `${BASE}/rankings/MX/players?limit=200`,
      `${BASE}/rankings/global/clubs?limit=200`,
      `${BASE}/rankings/global/brawlers/16000000?limit=200`,
      `${BASE}/brawlers`,
      `${BASE}/events/rotation`,
      `${BASE}/players/%232PP/battlelog`,
      `${BASE}/clubs/%232YPLQ`,
    ]);
  });

  it('404 → NOT_FOUND sin reintentar', async () => {
    const f = fakeFetch([{ status: 404, body: { reason: 'notFound' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.calls).toHaveLength(1);
  });

  it('429 → UPSTREAM_RATE_LIMITED con retryAfter del header, sin reintentar', async () => {
    const f = fakeFetch([{ status: 429, body: { reason: 'throttled' }, headers: { 'retry-after': '7' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED', retryAfter: 7 });
    expect(f.calls).toHaveLength(1);
  });

  it('429 sin Retry-After usa el cooldown por defecto (10s)', async () => {
    const f = fakeFetch([{ status: 429, body: {} }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ retryAfter: 10 });
  });

  it('503 inMaintenance → UPSTREAM_MAINTENANCE sin reintentar', async () => {
    const f = fakeFetch([{ status: 503, body: { reason: 'inMaintenance' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_MAINTENANCE' });
    expect(f.calls).toHaveLength(1);
  });

  it('500 y luego 200 → reintenta una vez y devuelve el dato', async () => {
    const f = fakeFetch([{ status: 500 }, { status: 200, body: { tag: '#2PP' } }]);
    await expect(client(f).getPlayer('2PP')).resolves.toEqual({ tag: '#2PP' });
    expect(f.calls).toHaveLength(2);
  });

  it('error de red dos veces → UPSTREAM_UNAVAILABLE tras 2 intentos', async () => {
    const f = fakeFetch([new TypeError('fetch failed'), new TypeError('fetch failed')]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(f.calls).toHaveLength(2);
  });

  it('200 con cuerpo no-JSON (HTML de un proxy) → UPSTREAM_UNAVAILABLE', async () => {
    const f = fakeFetch([{ status: 200, text: '<!DOCTYPE html><title>Maintenance</title>' }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('403 → UPSTREAM_UNAVAILABLE y log de error sin la key', async () => {
    const error = vi.fn();
    const logger = { error } as unknown as Logger;
    const f = fakeFetch([{ status: 403, body: { reason: 'accessDenied.invalidIp' } }]);
    await expect(client(f, { logger }).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain(KEY);
    expect(JSON.stringify(error.mock.calls)).toContain('accessDenied.invalidIp');
  });

  it('timeout → UPSTREAM_UNAVAILABLE', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      })) as typeof fetch;
    const c = createSupercellClient({ apiKey: KEY, baseUrl: BASE, fetchImpl: hang, timeoutMs: 20, retryDelayMs: 0 });
    await expect(c.getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('mode es live', () => {
    expect(client(fakeFetch([])).mode).toBe('live');
  });
});

describe('createLimiter', () => {
  it('nunca ejecuta más de max tareas a la vez', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return 'ok';
      });
    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(peak).toBe(2);
  });

  it('propaga el rechazo y libera el cupo', async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limit(async () => 'sigue')).resolves.toBe('sigue');
  });
});
