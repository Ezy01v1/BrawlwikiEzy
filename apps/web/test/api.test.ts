import { PlayerSchema } from '@brawlwiki/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiGet, apiRequest } from '@/lib/api';
import { attempt } from '@/lib/attempt';

const BASE = 'http://api.test/api/v1';
const META = { source: 'fresh', fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('apiGet', () => {
  it('devuelve data + meta validados', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: [1, 2], meta: META }));
    const r = await apiGet('/x', z.array(z.number()), { baseUrl: BASE, fetchImpl });
    expect(r).toEqual({ data: [1, 2], meta: META });
  });

  it('arma la URL, pide no-store y reenvía X-Forwarded-For solo si existe', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: 1, meta: META }));
    await apiGet('/players/2PP', z.number(), { baseUrl: BASE, fetchImpl, forwardedFor: '203.0.113.5' });
    await apiGet('/players/2PP', z.number(), { baseUrl: BASE, fetchImpl, forwardedFor: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/players/2PP`);
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('x-forwarded-for')).toBe('203.0.113.5');
    const [, init2] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(init2.headers).has('x-forwarded-for')).toBe(false);
  });

  it('error de la API → ApiError con code, status, retryAfter y requestId', async () => {
    const fetchImpl = vi.fn(async () =>
      json(429, { error: { code: 'RATE_LIMITED', message: 'Espera', requestId: 'r1', retryAfter: 30 } }),
    );
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Espera',
      status: 429,
      retryAfter: 30,
      requestId: 'r1',
    });
  });

  it('error sin cuerpo válido → INTERNAL y console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 502 }));
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Express caído (fetch rechaza) → NETWORK', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor de BrawlWiki.',
    });
  });

  it('timeout → NETWORK', async () => {
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl: hang, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('200 con forma inesperada → INTERNAL y console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json(200, { data: { tag: '#MAL' }, meta: META }));
    await expect(apiGet('/x', PlayerSchema, { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('apiRequest', () => {
  it('PUT manda método, Cookie, Origin, Content-Type JSON y el body; 204 → null', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const r = await apiRequest('PUT', '/me/favorites/player/2PP', null, {
      baseUrl: BASE,
      fetchImpl,
      cookie: 'bw_session=abc',
      origin: 'https://brawlwiki.test',
      forwardedFor: '203.0.113.5',
      body: { name: 'Ezy' },
    });
    expect(r).toBeNull();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/me/favorites/player/2PP`);
    expect(init.method).toBe('PUT');
    expect(init.cache).toBe('no-store');
    const h = new Headers(init.headers);
    expect(h.get('cookie')).toBe('bw_session=abc');
    expect(h.get('origin')).toBe('https://brawlwiki.test');
    expect(h.get('content-type')).toBe('application/json');
    expect(h.get('x-forwarded-for')).toBe('203.0.113.5');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Ezy' });
  });

  it('sin body, cookie ni origin no manda esos headers', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: { user: null }, meta: META }));
    const r = await apiRequest('GET', '/me', z.object({ user: z.null() }), { baseUrl: BASE, fetchImpl });
    expect(r).toEqual({ data: { user: null }, meta: META });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const h = new Headers(init.headers);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(h.has('cookie')).toBe(false);
    expect(h.has('origin')).toBe(false);
    expect(h.has('content-type')).toBe(false);
  });

  it('401 → ApiError UNAUTHENTICATED', async () => {
    const fetchImpl = vi.fn(async () =>
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión.', requestId: 'r2' } }),
    );
    const err = await apiRequest('POST', '/auth/logout', null, { baseUrl: BASE, fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED', status: 401, requestId: 'r2' });
  });

  it('200 sin schema → null; GET de apiGet que responde 204 → INTERNAL', async () => {
    const ok = vi.fn(async () => json(200, { data: { imported: 2 }, meta: META }));
    expect(await apiRequest('POST', '/x', null, { baseUrl: BASE, fetchImpl: ok })).toBeNull();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const empty = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl: empty })).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    spy.mockRestore();
  });
});

describe('attempt', () => {
  it('envuelve éxito y ApiError; relanza lo demás', async () => {
    expect(await attempt(Promise.resolve(1))).toEqual({ ok: true, value: 1 });
    const err = new ApiError('NOT_FOUND', 'x', { status: 404 });
    expect(await attempt(Promise.reject(err))).toEqual({ ok: false, error: err });
    await expect(attempt(Promise.reject(new Error('bug')))).rejects.toThrow('bug');
  });
});
