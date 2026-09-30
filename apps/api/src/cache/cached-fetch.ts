import { AppError, isAppError, UPSTREAM_CODES } from '../errors';
import type { Logger } from '../logger';
import type { DataResult } from '../types';
import type { Cache } from './cache';
import { type CachePolicy, DEFAULT_COOLDOWN_SECONDS, NEGATIVE_TTL_SECONDS } from './policies';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export interface FetchOptions {
  /** Se llama justo antes de consultar a Supercell (solo en el request líder). Puede lanzar AppError. */
  beforeUpstream?: () => void;
}

export type CachedFetch = <T>(
  key: string,
  policy: CachePolicy,
  fetcher: () => Promise<T>,
  options?: FetchOptions,
) => Promise<DataResult<T>>;

export const COOLDOWN_KEY = 'cooldown:supercell';

function isEntry(x: unknown): x is CacheEntry<unknown> {
  return typeof x === 'object' && x !== null && 'data' in x && typeof (x as { fetchedAt?: unknown }).fetchedAt === 'number';
}

export function createCachedFetch(deps: { cache: Cache; now?: () => number; logger?: Pick<Logger, 'warn'> }) {
  const { cache, logger } = deps;
  const now = deps.now ?? Date.now;
  const inflight = new Map<string, Promise<DataResult<unknown>>>();

  async function safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await cache.get<T>(key);
    } catch (err) {
      logger?.warn({ err, key }, 'caché no disponible (lectura)');
      return undefined;
    }
  }

  async function safeSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await cache.set(key, value, ttlSeconds);
    } catch (err) {
      logger?.warn({ err, key }, 'caché no disponible (escritura)');
    }
  }

  async function cooldownRemaining(): Promise<number> {
    const until = await safeGet<number>(COOLDOWN_KEY);
    return typeof until === 'number' ? Math.max(0, until - now()) : 0;
  }

  async function resolveUpstream<T>(
    key: string,
    policy: CachePolicy,
    fetcher: () => Promise<T>,
    entry: CacheEntry<T> | undefined,
    options: FetchOptions,
  ): Promise<DataResult<T>> {
    const stale = (): DataResult<T> | undefined =>
      entry ? { data: entry.data, source: 'stale', fetchedAt: entry.fetchedAt } : undefined;

    const remaining = await cooldownRemaining();
    if (remaining > 0) {
      const s = stale();
      if (s) return s;
      throw new AppError('UPSTREAM_RATE_LIMITED', undefined, { retryAfter: Math.ceil(remaining / 1000) });
    }

    try {
      options.beforeUpstream?.();
      const data = await fetcher();
      const fetchedAt = now();
      await safeSet(key, { data, fetchedAt } satisfies CacheEntry<T>, policy.staleTtl);
      return { data, source: 'fresh', fetchedAt };
    } catch (err) {
      if (!isAppError(err)) throw err;
      if (err.code === 'NOT_FOUND') {
        await safeSet(`404:${key}`, 1, NEGATIVE_TTL_SECONDS);
        throw err;
      }
      if (err.code === 'UPSTREAM_RATE_LIMITED') {
        const seconds = err.retryAfter ?? DEFAULT_COOLDOWN_SECONDS;
        await safeSet(COOLDOWN_KEY, now() + seconds * 1000, seconds);
      }
      if (UPSTREAM_CODES.has(err.code) || err.code === 'RATE_LIMITED') {
        const s = stale();
        if (s) return s;
      }
      throw err;
    }
  }

  const cachedFetch: CachedFetch = async (key, policy, fetcher, options = {}) => {
    if (await safeGet(`404:${key}`)) throw new AppError('NOT_FOUND');

    const raw = await safeGet<unknown>(key);
    const entry = isEntry(raw) ? (raw as CacheEntry<never>) : undefined;
    if (entry && now() - entry.fetchedAt < policy.freshTtl * 1000) {
      return { data: entry.data, source: 'cache', fetchedAt: entry.fetchedAt };
    }

    const pending = inflight.get(key);
    if (pending) return pending as never;

    const p = resolveUpstream(key, policy, fetcher, entry, options).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };

  return {
    cachedFetch,
    isCoolingDown: async () => (await cooldownRemaining()) > 0,
  };
}
