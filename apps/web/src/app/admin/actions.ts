'use server';

import { SeasonSchema } from '@brawlwiki/shared';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/account';
import { SEASON_NAME_MAX } from '@/lib/admin';
import { ApiError, apiRequest } from '@/lib/api';
import { requestContext } from '@/lib/queries';
import { getSession } from '@/lib/session';

// Como en /cuenta: la acción se puede invocar con un POST directo, así que el nombre se valida aquí
// (la API lo vuelve a validar y exige sesión, Origin y rol de administrador). Los errores vuelven como dato.

/**
 * Cierra la temporada activa y abre una nueva con ese nombre. La API responde 404 (y no 403) a quien no es
 * administrador *ni a quien no tiene sesión*, para no revelar la ruta. Aquí ese 404 se desambigua con la sesión:
 * sin usuario (la sesión venció tras cargar /admin) → UNAUTHENTICATED, para ofrecer volver a entrar; en cualquier otro
 * caso → FORBIDDEN.
 */
export async function openSeason(name: string): Promise<ActionResult> {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > SEASON_NAME_MAX) return { ok: false, code: 'INVALID_PARAM' };

  const ctx = await requestContext();
  try {
    await apiRequest('POST', '/seasons', SeasonSchema, { body: { name: trimmed }, ...ctx });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code !== 'NOT_FOUND') return { ok: false, code: e.code };
      // Solo en el camino de fallo; `getSession` está cacheada por request.
      try {
        const { enabled, user } = await getSession();
        return { ok: false, code: enabled && !user ? 'UNAUTHENTICATED' : 'FORBIDDEN' };
      } catch {
        // getSession relanza lo que no es ApiError (p. ej. una respuesta inesperada de /me): la acción nunca lanza.
        return { ok: false, code: 'FORBIDDEN' };
      }
    }
    console.error('[admin] abrir temporada falló', e instanceof Error ? e.message : e);
    return { ok: false, code: 'INTERNAL' };
  }
  revalidatePath('/admin');
  revalidatePath('/tierlist');
  return { ok: true };
}
