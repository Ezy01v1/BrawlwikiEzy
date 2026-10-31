import type { Health } from '@brawlwiki/shared';
import type { Cache } from './cache/cache';
import type { SupercellApi } from './supercell/types';

export function createHealth(deps: {
  cache: Cache;
  supercell: SupercellApi;
  isCoolingDown(): Promise<boolean>;
  db?: { ping(): Promise<boolean> };
}): () => Promise<Health> {
  async function supercellStatus(): Promise<Health['supercell']> {
    if (deps.supercell.mode === 'mock') return 'mock';
    if (deps.supercell.isAuthRejected?.()) return 'unauthorized';
    return (await deps.isCoolingDown()) ? 'cooldown' : 'ok';
  }
  async function dbStatus(): Promise<Health['db']> {
    if (!deps.db) return 'disabled';
    return (await deps.db.ping()) ? 'ok' : 'down';
  }
  return async () => {
    const [supercell, db] = await Promise.all([supercellStatus(), dbStatus()]);
    return { status: 'ok', cache: deps.cache.kind, supercell, db };
  };
}
