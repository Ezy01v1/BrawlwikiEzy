import type { DataSource } from '@brawlwiki/shared';

/** Resultado de una lectura con procedencia. `fetchedAt` en epoch ms. */
export interface DataResult<T> {
  data: T;
  source: DataSource;
  fetchedAt: number;
}
