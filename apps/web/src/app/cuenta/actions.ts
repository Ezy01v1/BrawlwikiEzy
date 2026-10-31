'use server';

import { MeSchema } from '@brawlwiki/shared';
import { parseTag } from '@brawlwiki/shared/tags';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ActionResult, DELETE_CONFIRM_WORD, SESSION_COOKIE } from '@/lib/account';
import { ApiError, type ApiMethod, apiRequest } from '@/lib/api';
import { requestContext } from '@/lib/queries';
import type { z } from 'zod';

// Las Server Actions se pueden invocar con un POST directo: los argumentos se validan aquí y la API
// vuelve a exigir sesión y Origin. Next además compara el Origin del navegador con el Host antes de ejecutarlas.

async function callApi<T>(
  method: ApiMethod,
  path: string,
  schema: z.ZodType<T> | null,
  body?: unknown,
): Promise<ActionResult> {
  const ctx = await requestContext();
  try {
    await apiRequest(method, path, schema, { ...(body === undefined ? {} : { body }), ...ctx });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code };
    console.error('[cuenta] la acción falló', method, path, e instanceof Error ? e.message : e);
    return { ok: false, code: 'INTERNAL' };
  }
}

/** Vincula (o con `null` desvincula) el tag de jugador de la cuenta. */
export async function linkTag(tag: string | null): Promise<ActionResult> {
  let playerTag: string | null = null;
  if (tag !== null) {
    playerTag = typeof tag === 'string' ? parseTag(tag) : null;
    if (!playerTag) return { ok: false, code: 'INVALID_TAG' };
  }
  const r = await callApi('PATCH', '/me', MeSchema, { playerTag });
  // El header, la home y el perfil muestran "Mi perfil" / "Este soy yo" según el tag.
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}

/**
 * Borra la cuenta. La API expira `bw_session` en su respuesta, pero esa respuesta la recibe el servidor de Next:
 * la cookie se expira de nuevo aquí con `cookies().delete`, que sí llega al navegador.
 */
export async function deleteAccount(confirm: string): Promise<ActionResult> {
  if (confirm !== DELETE_CONFIRM_WORD) return { ok: false, code: 'CONFIRM_MISMATCH' };
  const r = await callApi('DELETE', '/me', null);
  if (!r.ok) return r;
  (await cookies()).delete({
    name: SESSION_COOKIE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/', 'layout');
  redirect('/');
}
