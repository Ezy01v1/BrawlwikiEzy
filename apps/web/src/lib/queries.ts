import { BattleSchema, EventSlotSchema, PlayerSchema } from '@brawlwiki/shared';
import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { apiGet } from './api';

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
