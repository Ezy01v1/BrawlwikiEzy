'use server';

import { SaveTierListBodySchema } from '@brawlwiki/shared';
import { revalidatePath } from 'next/cache';
import { ApiError, apiRequest } from '@/lib/api';
import { requestContext } from '@/lib/queries';
import type { SaveTierListResult, TierVote } from '@/lib/tier-editor';

// Como en /cuenta y /favorites: la acción se puede invocar con un POST directo, así que el cuerpo se valida aquí
// (la API lo vuelve a validar y exige sesión y Origin). Los errores vuelven como dato, nunca se lanzan.

/** Reemplaza todos los votos del usuario en la temporada abierta. Los "Sin ubicar" simplemente no van. */
export async function saveTierList(votes: TierVote[]): Promise<SaveTierListResult> {
  const body = SaveTierListBodySchema.safeParse({ votes });
  if (!body.success) return { ok: false, code: 'INVALID_PARAM' };

  const ctx = await requestContext();
  try {
    await apiRequest('PUT', '/tierlist/me', null, { body: body.data, ...ctx });
  } catch (e) {
    if (e instanceof ApiError) {
      return e.retryAfter === undefined
        ? { ok: false, code: e.code }
        : { ok: false, code: e.code, retryAfter: e.retryAfter };
    }
    console.error('[tierlist] guardar falló', e instanceof Error ? e.message : e);
    return { ok: false, code: 'INTERNAL' };
  }
  // La API ya invalidó su caché: la página pública muestra el agregado nuevo.
  revalidatePath('/tierlist');
  return { ok: true };
}
