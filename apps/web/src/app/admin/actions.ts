'use server';

import { SeasonSchema } from '@brawlwiki/shared';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/account';
import { SEASON_NAME_MAX } from '@/lib/admin';
import { ApiError, apiRequest } from '@/lib/api';
import { requestContext } from '@/lib/queries';

// Como en /cuenta: la acción se puede invocar con un POST directo, así que el nombre se valida aquí
// (la API lo vuelve a validar y exige sesión, Origin y rol de administrador). Los errores vuelven como dato.

/**
 * Cierra la temporada activa y abre una nueva con ese nombre. La API responde 404 (y no 403) a quien no es
 * administrador para no revelar la ruta: aquí ese 404 se traduce a FORBIDDEN.
 */
export async function openSeason(name: string): Promise<ActionResult> {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > SEASON_NAME_MAX) return { ok: false, code: 'INVALID_PARAM' };

  const ctx = await requestContext();
  try {
    await apiRequest('POST', '/seasons', SeasonSchema, { body: { name: trimmed }, ...ctx });
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code === 'NOT_FOUND' ? 'FORBIDDEN' : e.code };
    console.error('[admin] abrir temporada falló', e instanceof Error ? e.message : e);
    return { ok: false, code: 'INTERNAL' };
  }
  revalidatePath('/admin');
  revalidatePath('/tierlist');
  return { ok: true };
}
