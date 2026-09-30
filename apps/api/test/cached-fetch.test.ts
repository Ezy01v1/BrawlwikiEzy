import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cache } from '../src/cache/cache';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { AppError } from '../src/errors';

const POLICY = { freshTtl: 60, staleTtl: 3600 };
let t: number;
let cache: Cache;
let cf: ReturnType<typeof createCachedFetch>;

beforeEach(() => {
  t = 1_000_000;
  cache = createMemoryCache({ now: () => t });
  cf = createCachedFetch({ cache, now: () => t });
});

const fail = (code: ConstructorParameters<typeof AppError>[0], retryAfter?: number) =>
  vi.fn(async () => {
    throw new AppError(code, undefined, retryAfter === undefined ? {} : { retryAfter });
  });

describe('cachedFetch', () => {
  it('sin dato → llama al fetcher y responde fresh', async () => {
    const fetcher = vi.fn(async () => 'A');
    await expect(cf.cachedFetch('k', POLICY, fetcher)).resolves.toEqual({ data: 'A', source: 'fresh', fetchedAt: t });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('dentro de freshTtl → responde cache sin llamar al fetcher', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    const fetchedAt = t;
    t += 59_000;
    const fetcher = vi.fn(async () => 'B');
    await expect(cf.cachedFetch('k', POLICY, fetcher)).resolves.toEqual({ data: 'A', source: 'cache', fetchedAt });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('vencido y Supercell ok → fresh con dato nuevo', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    t += 61_000;
    await expect(cf.cachedFetch('k', POLICY, async () => 'B')).resolves.toMatchObject({ data: 'B', source: 'fresh' });
  });

  it('vencido y Supercell caído → stale con el fetchedAt original', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    const fetchedAt = t;
    t += 61_000;
    for (const code of ['UPSTREAM_UNAVAILABLE', 'UPSTREAM_MAINTENANCE'] as const) {
      await expect(cf.cachedFetch('k', POLICY, fail(code))).resolves.toEqual({ data: 'A', source: 'stale', fetchedAt });
    }
  });

  it('sin dato y Supercell caído → propaga el error', async () => {
    await expect(cf.cachedFetch('k', POLICY, fail('UPSTREAM_UNAVAILABLE'))).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });

  it('NOT_FOUND se cachea 60s como negativo', async () => {
    const f1 = fail('NOT_FOUND');
    await expect(cf.cachedFetch('k', POLICY, f1)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const f2 = vi.fn(async () => 'A');
    await expect(cf.cachedFetch('k', POLICY, f2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f2).not.toHaveBeenCalled();
    t += 60_000;
    await expect(cf.cachedFetch('k', POLICY, f2)).resolves.toMatchObject({ data: 'A' });
  });

  it('dedupe: dos pedidos simultáneos → una sola llamada upstream', async () => {
    let release!: (v: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((r) => (release = r)));
    const a = cf.cachedFetch('k', POLICY, fetcher);
    const b = cf.cachedFetch('k', POLICY, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    release('A');
    await expect(Promise.all([a, b])).resolves.toEqual([
      { data: 'A', source: 'fresh', fetchedAt: t },
      { data: 'A', source: 'fresh', fetchedAt: t },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('429 activa cooldown: no se llama a Supercell y se sirve stale o error', async () => {
    await cf.cachedFetch('conDato', POLICY, async () => 'A');
    t += 61_000;
    await expect(cf.cachedFetch('otro', POLICY, fail('UPSTREAM_RATE_LIMITED', 30))).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
    });
    expect(await cf.isCoolingDown()).toBe(true);

    const fetcher = vi.fn(async () => 'B');
    await expect(cf.cachedFetch('conDato', POLICY, fetcher)).resolves.toMatchObject({ data: 'A', source: 'stale' });
    await expect(cf.cachedFetch('sinDato', POLICY, fetcher)).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
      retryAfter: 30,
    });
    expect(fetcher).not.toHaveBeenCalled();

    t += 30_000;
    expect(await cf.isCoolingDown()).toBe(false);
    await expect(cf.cachedFetch('sinDato', POLICY, fetcher)).resolves.toMatchObject({ data: 'B', source: 'fresh' });
  });

  it('beforeUpstream: no se llama en un acierto de caché; si lanza RATE_LIMITED se sirve stale o se propaga', async () => {
    const guard = vi.fn(() => {
      throw new AppError('RATE_LIMITED', undefined, { retryAfter: 5 });
    });
    await expect(cf.cachedFetch('k', POLICY, async () => 'A', { beforeUpstream: guard })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await cf.cachedFetch('k', POLICY, async () => 'A');
    guard.mockClear();
    await cf.cachedFetch('k', POLICY, async () => 'B', { beforeUpstream: guard });
    expect(guard).not.toHaveBeenCalled();
    t += 61_000;
    await expect(cf.cachedFetch('k', POLICY, async () => 'B', { beforeUpstream: guard })).resolves.toMatchObject({
      data: 'A',
      source: 'stale',
    });
  });

  it('caché rota (get/set lanzan) → se trata como vacía y responde fresh', async () => {
    const broken: Cache = {
      kind: 'redis',
      get: async () => {
        throw new Error('ECONNREFUSED');
      },
      set: async () => {
        throw new Error('ECONNREFUSED');
      },
      del: async () => undefined,
    };
    const warn = vi.fn();
    const c = createCachedFetch({ cache: broken, now: () => t, logger: { warn } as never });
    await expect(c.cachedFetch('k', POLICY, async () => 'A')).resolves.toMatchObject({ data: 'A', source: 'fresh' });
    expect(warn).toHaveBeenCalled();
  });

  it('entrada con forma basura → se trata como vacía', async () => {
    await cache.set('k', 'no-soy-una-entrada', 3600);
    await expect(cf.cachedFetch('k', POLICY, async () => 'A')).resolves.toMatchObject({ data: 'A', source: 'fresh' });
  });
});
