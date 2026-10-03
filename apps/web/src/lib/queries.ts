import {
  BattleSchema,
  BrawlerSchema,
  ClubRankingSchema,
  ClubSchema,
  EventSlotSchema,
  PlayerRankingSchema,
  PlayerSchema,
} from '@brawlwiki/shared';
import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { apiGet } from './api';
import { RANKING_LIMIT } from './rankings';

/** Reenvía la IP del usuario tal cual llegó (Nginx la agrega); Express confía solo en loopback. */
async function forwardedFor(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for') ?? h.get('x-real-ip');
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

export const getBrawlerRankings = cache(async (brawlerId: number, region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/brawlers/${brawlerId}${rankingQuery(region, limit)}`, z.array(PlayerRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);
