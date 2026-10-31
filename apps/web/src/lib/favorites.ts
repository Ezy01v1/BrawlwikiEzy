import type { Favorite } from '@brawlwiki/shared';
import { parseTag } from '@brawlwiki/shared/tags';
import type { ActionErrorCode } from './account';
import type { SavedEntry } from './local-store';

// Los favoritos locales usan `type` y la API `kind`: la conversión vive solo aquí.
// Sin imports de servidor: lo usan el cliente (importador) y las Server Actions.

export type FavoriteKind = Favorite['kind'];
export interface FavoriteItem {
  kind: FavoriteKind;
  tag: string;
  name: string;
}

/** Resultado de `importFavorites`: cuántos favoritos eran nuevos en la cuenta. */
export type ImportResult = { ok: true; imported: number } | { ok: false; code: ActionErrorCode };

/** Igual que la API (`PUT /me/favorites` y `POST /me/favorites/import`). */
export const FAVORITE_NAME_MAX = 64;
export const IMPORT_MAX = 100;

export function isFavoriteKind(value: unknown): value is FavoriteKind {
  return value === 'player' || value === 'club';
}

/** Recortado y sin pasar de 64; algo que no es texto queda vacío (la API pone `#TAG`). */
export function cleanFavoriteName(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, FAVORITE_NAME_MAX).trim() : '';
}

export function favoriteToEntry(f: Favorite): SavedEntry {
  return { type: f.kind, tag: f.tag, name: f.name };
}

/**
 * Favoritos locales → ítems para `importFavorites`. La API rechaza todo el envío si un tag es inválido, así que
 * los inválidos se descartan aquí (con el mismo parser que la búsqueda). Sin repetidos y como máximo 100: la
 * lista local tiene el más reciente primero, así que quedan los más recientes.
 */
export function toImportItems(entries: readonly SavedEntry[]): FavoriteItem[] {
  const seen = new Set<string>();
  const items: FavoriteItem[] = [];
  for (const e of entries) {
    const tag = parseTag(e.tag);
    if (!tag || !isFavoriteKind(e.type)) continue;
    const id = `${e.type}:${tag}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ kind: e.type, tag, name: cleanFavoriteName(e.name) });
    if (items.length === IMPORT_MAX) break;
  }
  return items;
}
