import type { DataSource } from '@brawlwiki/shared';

/** Resultado de una lectura con procedencia. `fetchedAt` en epoch ms. */
export interface DataResult<T> {
  data: T;
  source: DataSource;
  fetchedAt: number;
}

declare global {
  namespace Express {
    interface Request {
      /** Usuario de la sesión (lo pone `loadUser` en las rutas de Comunidad). */
      user?: import('./community/sessions').SessionUser & { isAdmin: boolean };
    }
  }
}
