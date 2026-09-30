import Redis from 'ioredis';
import type { Cache } from './cache';

export type RedisCache = Cache & { client: Redis; quit(): Promise<void> };

export function createRedisCache(
  url: string,
  onError: (err: Error) => void = () => {},
): RedisCache {
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, commandTimeout: 300 });
  client.on('error', onError);

  return {
    kind: 'redis',
    client,
    async get<T>(key: string) {
      const raw = await client.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      await client.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.ceil(ttlSeconds)));
    },
    async del(key: string) {
      await client.del(key);
    },
    async quit() {
      await client.quit();
    },
  };
}
