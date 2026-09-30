import { describe, expect, it, vi } from 'vitest';
import type { Cache } from '../src/cache/cache';
import { createMemoryCache } from '../src/cache/memory';
import { createRedisCache } from '../src/cache/redis';

function contract(name: string, make: () => Cache | Promise<Cache>) {
  describe(`Cache contract: ${name}`, () => {
    it('guarda y lee valores JSON', async () => {
      const c = await make();
      await c.set('k:1', { a: 1, b: ['x'] }, 60);
      expect(await c.get('k:1')).toEqual({ a: 1, b: ['x'] });
    });

    it('devuelve undefined si no existe', async () => {
      const c = await make();
      expect(await c.get('k:nope')).toBeUndefined();
    });

    it('del borra la clave', async () => {
      const c = await make();
      await c.set('k:2', 1, 60);
      await c.del('k:2');
      expect(await c.get('k:2')).toBeUndefined();
    });

    it('los valores leídos no comparten referencia con lo guardado', async () => {
      const c = await make();
      const v = { n: 1 };
      await c.set('k:3', v, 60);
      v.n = 2;
      expect(await c.get('k:3')).toEqual({ n: 1 });
    });
  });
}

contract('memory', () => createMemoryCache());

describe.skipIf(!process.env.REDIS_URL)('redis', () => {
  contract('redis', () => createRedisCache(process.env.REDIS_URL!));
});

describe('RedisCache error handling', () => {
  it('registra listener de error para evitar crash en unhandled errors', async () => {
    const onError = vi.fn();
    const cache = createRedisCache('redis://127.0.0.1:1', onError);

    const testError = new Error('boom');
    cache.client.emit('error', testError);

    expect(onError).toHaveBeenCalledWith(testError);

    await cache.client.disconnect();
  });
});

describe('MemoryCache específico', () => {
  it('expira según el TTL usando el reloj inyectado', async () => {
    let t = 0;
    const c = createMemoryCache({ now: () => t });
    await c.set('k', 'v', 10);
    t = 9_999;
    expect(await c.get('k')).toBe('v');
    t = 10_000;
    expect(await c.get('k')).toBeUndefined();
  });

  it('desaloja la entrada menos usada al superar max', async () => {
    const c = createMemoryCache({ max: 2 });
    await c.set('a', 1, 60);
    await c.set('b', 2, 60);
    await c.get('a'); // a pasa a ser la más reciente
    await c.set('c', 3, 60); // desaloja b
    expect(await c.get('a')).toBe(1);
    expect(await c.get('b')).toBeUndefined();
    expect(await c.get('c')).toBe(3);
  });

  it('kind es memory', () => {
    expect(createMemoryCache().kind).toBe('memory');
  });
});
