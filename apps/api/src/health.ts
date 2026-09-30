import type { Health } from '@brawlwiki/shared';
import type { Cache } from './cache/cache';
import type { SupercellApi } from './supercell/types';

export function createHealth(deps: {
  cache: Cache;
  supercell: SupercellApi;
  isCoolingDown(): Promise<boolean>;
}): () => Promise<Health> {
  return async () => ({
    status: 'ok',
    cache: deps.cache.kind,
    supercell: deps.supercell.mode === 'mock' ? 'mock' : (await deps.isCoolingDown()) ? 'cooldown' : 'ok',
  });
}
