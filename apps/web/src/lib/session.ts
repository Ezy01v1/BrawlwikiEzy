import { MeSchema, type User } from '@brawlwiki/shared';
import { cache } from 'react';
import { ApiError, apiRequest } from './api';
import { requestContext } from './queries';

export interface Session {
  /** false si la API corre sin Comunidad (404), sin MySQL (503) o no responde: la web oculta el login. */
  enabled: boolean;
  user: User | null;
}

/**
 * El header pide la sesión en todas las páginas, fuera de un Suspense: con la API o MySQL colgados no puede
 * frenar las rutas de la v1 los 6 s de API_TIMEOUT_MS. Al cortar, cae en NETWORK → Comunidad deshabilitada.
 */
export const SESSION_TIMEOUT_MS = 1500;

/** Sesión del request actual; `cache` la deduplica entre el layout, la página y sus componentes. */
export const getSession = cache(async (): Promise<Session> => {
  const { forwardedFor, cookie } = await requestContext();
  try {
    const r = await apiRequest('GET', '/me', MeSchema, { forwardedFor, cookie, timeoutMs: SESSION_TIMEOUT_MS });
    return { enabled: true, user: r?.data.user ?? null };
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const expected = e.code === 'NETWORK' || e.status === 404 || e.code === 'DB_UNAVAILABLE';
    if (!expected) console.error('[session] GET /me falló', e.code, e.status);
    return { enabled: false, user: null };
  }
});

export async function getMe(): Promise<User | null> {
  return (await getSession()).user;
}
