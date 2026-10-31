'use server';

import { parseTag } from '@brawlwiki/shared/tags';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionErrorCode, ActionResult } from '@/lib/account';
import { ApiError, type ApiMethod, apiRequest } from '@/lib/api';
import {
  cleanFavoriteName,
  type FavoriteItem,
  type FavoriteKind,
  IMPORT_MAX,
  type ImportResult,
  isFavoriteKind,
} from '@/lib/favorites';
import { requestContext } from '@/lib/queries';

// Como en /cuenta: las Server Actions se pueden invocar con un POST directo, así que los argumentos se validan
// aquí antes de llamar a la API (que vuelve a validar y exige sesión y Origin). Los errores vuelven como dato.

type Failure = { ok: false; code: ActionErrorCode };

const ImportedSchema = z.object({ imported: z.number().int().nonnegative() });

async function callApi<T>(
  method: ApiMethod,
  path: string,
  schema: z.ZodType<T> | null,
  body?: unknown,
): Promise<{ ok: true; data: T | null } | Failure> {
  const ctx = await requestContext();
  try {
    const r = await apiRequest(method, path, schema, { ...(body === undefined ? {} : { body }), ...ctx });
    return { ok: true, data: r?.data ?? null };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code };
    console.error('[favoritos] la acción falló', method, path, e instanceof Error ? e.message : e);
    return { ok: false, code: 'INTERNAL' };
  }
}

/** kind + tag validados y normalizados, o el código de error. */
function target(kind: unknown, tag: unknown): { kind: FavoriteKind; tag: string } | Failure {
  if (!isFavoriteKind(kind)) return { ok: false, code: 'INVALID_PARAM' };
  const parsed = typeof tag === 'string' ? parseTag(tag) : null;
  if (!parsed) return { ok: false, code: 'INVALID_TAG' };
  return { kind, tag: parsed };
}

const favoritePath = (kind: FavoriteKind, tag: string) => `/me/favorites/${kind}/${encodeURIComponent(tag)}`;

/** Agrega a los favoritos de la cuenta (repetir no falla). La home lista los favoritos: se revalida. */
export async function addFavorite(kind: FavoriteKind, tag: string, name: string): Promise<ActionResult> {
  const t = target(kind, tag);
  if ('ok' in t) return t;
  // La API exige un nombre de 1 a 64: sin nombre se guarda como "#TAG", igual que al importar.
  const r = await callApi('PUT', favoritePath(t.kind, t.tag), null, { name: cleanFavoriteName(name) || `#${t.tag}` });
  if (!r.ok) return r;
  revalidatePath('/');
  return { ok: true };
}

export async function removeFavorite(kind: FavoriteKind, tag: string): Promise<ActionResult> {
  const t = target(kind, tag);
  if ('ok' in t) return t;
  const r = await callApi('DELETE', favoritePath(t.kind, t.tag), null);
  if (!r.ok) return r;
  revalidatePath('/');
  return { ok: true };
}

/**
 * Sube los favoritos locales en el primer login. Devuelve cuántos eran nuevos en la cuenta. Un ítem inválido
 * rechaza todo (como la API): el importador ya descarta los inválidos antes de llamar.
 */
export async function importFavorites(items: FavoriteItem[]): Promise<ImportResult> {
  if (!Array.isArray(items) || items.length > IMPORT_MAX) return { ok: false, code: 'INVALID_PARAM' };
  const clean: FavoriteItem[] = [];
  for (const item of items as unknown[]) {
    if (typeof item !== 'object' || item === null) return { ok: false, code: 'INVALID_PARAM' };
    const { kind, tag, name } = item as Record<string, unknown>;
    const t = target(kind, tag);
    if ('ok' in t) return t;
    clean.push({ ...t, name: cleanFavoriteName(name) });
  }
  if (clean.length === 0) return { ok: true, imported: 0 };

  const r = await callApi('POST', '/me/favorites/import', ImportedSchema, { items: clean });
  if (!r.ok) return r;
  const imported = r.data?.imported ?? 0;
  // Cambian los favoritos de la home y el estado de cualquier botón de favorito ya renderizado.
  if (imported > 0) revalidatePath('/', 'layout');
  return { ok: true, imported };
}
