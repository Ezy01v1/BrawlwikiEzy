import {
  BattleSchema,
  BrawlerSchema,
  ClubRankingSchema,
  ClubSchema,
  EventSlotSchema,
  type Favorite,
  FavoriteSchema,
  PlayerRankingSchema,
  PlayerSchema,
} from '@brawlwiki/shared';
import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { ApiError, apiGet, apiRequest } from './api';
import { RANKING_LIMIT } from './rankings';
import { siteOrigin } from './site';

export interface RequestContext {
  /** IP del usuario tal cual llegó (Nginx la agrega); Express confía solo en loopback. */
  forwardedFor: string | null;
  /** Header `Cookie` del navegador, tal cual (la API solo lee `bw_session`). */
  cookie: string | null;
  /** Origin del sitio público, para los requests que modifican (la API lo exige). */
  origin: string;
}

export async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    forwardedFor: h.get('x-forwarded-for') ?? h.get('x-real-ip'),
    cookie: h.get('cookie'),
    origin: siteOrigin(),
  };
}

async function forwardedFor(): Promise<string | null> {
  return (await requestContext()).forwardedFor;
}

const enc = encodeURIComponent;

// `cache` deduplica dentro de un mismo request (generateMetadata + página). Next no deduplica
// por su cuenta los fetch que llevan `signal`, y apiGet siempre pasa uno por el timeout.

export const getPlayer = cache(async (tag: string) =>
  apiGet(`/players/${enc(tag)}`, PlayerSchema, { forwardedFor: await forwardedFor() }),
);

export const getBattleLog = cache(async (tag: string) =>
  apiGet(`/players/${enc(tag)}/battlelog`, z.array(BattleSchema), { forwardedFor: await forwardedFor() }),
);

export const getEventRotation = cache(async () =>
  apiGet('/events/rotation', z.array(EventSlotSchema), { forwardedFor: await forwardedFor() }),
);

export const getClub = cache(async (tag: string) =>
  apiGet(`/clubs/${enc(tag)}`, ClubSchema, { forwardedFor: await forwardedFor() }),
);

export const getBrawlers = cache(async () =>
  apiGet('/brawlers', z.array(BrawlerSchema), { forwardedFor: await forwardedFor() }),
);

export const getBrawler = cache(async (id: number) =>
  apiGet(`/brawlers/${id}`, BrawlerSchema, { forwardedFor: await forwardedFor() }),
);

const rankingQuery = (region: string, limit: number) => `?region=${enc(region)}&limit=${limit}`;

export const getPlayerRankings = cache(async (region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/players${rankingQuery(region, limit)}`, z.array(PlayerRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);

export const getClubRankings = cache(async (region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/clubs${rankingQuery(region, limit)}`, z.array(ClubRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);

/** Corto como el de la sesión: la home y los perfiles lo esperan, y no pueden colgarse si MySQL anda lento. */
export const FAVORITES_TIMEOUT_MS = 1500;

/**
 * Favoritos de la cuenta (el más reciente primero). Solo con sesión: quien llama mira `getSession()` antes.
 * Si falla devuelve `[]`: los favoritos no pueden tirar la home ni un perfil.
 */
export const getFavorites = cache(async (): Promise<Favorite[]> => {
  const { forwardedFor, cookie } = await requestContext();
  try {
    const r = await apiRequest('GET', '/me/favorites', z.array(FavoriteSchema), {
      forwardedFor,
      cookie,
      timeoutMs: FAVORITES_TIMEOUT_MS,
    });
    return r?.data ?? [];
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    console.error('[favoritos] GET /me/favorites falló', e.code, e.status);
    return [];
  }
});

export const getBrawlerRankings = cache(async (brawlerId: number, region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/brawlers/${brawlerId}${rankingQuery(region, limit)}`, z.array(PlayerRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);
