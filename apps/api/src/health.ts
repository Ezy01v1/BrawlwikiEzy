import type { Health } from '@brawlwiki/shared';
import type { Cache } from './cache/cache';
import type { SupercellApi } from './supercell/types';

export function createHealth(deps: {
  cache: Cache;
  supercell: SupercellApi;
  isCoolingDown(): Promise<boolean>;
}): () => Promise<Health> {
  async function supercellStatus(): Promise<Health['supercell']> {
    if (deps.supercell.mode === 'mock') return 'mock';
    if (deps.supercell.isAuthRejected?.()) return 'unauthorized';
    return (await deps.isCoolingDown()) ? 'cooldown' : 'ok';
  }
  return async () => ({ status: 'ok', cache: deps.cache.kind, supercell: await supercellStatus() });
}
