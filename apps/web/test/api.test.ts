import { PlayerSchema } from '@brawlwiki/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiGet } from '@/lib/api';
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

describe('attempt', () => {
  it('envuelve éxito y ApiError; relanza lo demás', async () => {
    expect(await attempt(Promise.resolve(1))).toEqual({ ok: true, value: 1 });
    const err = new ApiError('NOT_FOUND', 'x', { status: 404 });
    expect(await attempt(Promise.reject(err))).toEqual({ ok: false, error: err });
    await expect(attempt(Promise.reject(new Error('bug')))).rejects.toThrow('bug');
  });
});
