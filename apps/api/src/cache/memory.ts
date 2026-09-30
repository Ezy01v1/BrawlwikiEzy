import type { Cache } from './cache';

interface Slot {
  value: unknown;
  expiresAt: number;
}

export function createMemoryCache(opts: { max?: number; now?: () => number } = {}): Cache {
  const max = opts.max ?? 5000;
  const now = opts.now ?? Date.now;
  const store = new Map<string, Slot>();

  return {
    kind: 'memory',
    async get<T>(key: string) {
      const slot = store.get(key);
      if (!slot) return undefined;
      if (now() >= slot.expiresAt) {
        store.delete(key);
        return undefined;
      }
      // Reinsertar para marcarla como la más reciente (orden LRU del Map).
      store.delete(key);
      store.set(key, slot);
      return structuredClone(slot.value) as T;
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      store.delete(key);
      store.set(key, { value: structuredClone(value), expiresAt: now() + ttlSeconds * 1000 });
      while (store.size > max) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    async del(key: string) {
      store.delete(key);
    },
  };
}
