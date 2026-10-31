import { type FavoriteKind, favoriteToEntry } from './favorites';
import type { SavedEntry } from './local-store';
import { getFavorites } from './queries';
import { getSession } from './session';

/** Lo que el servidor le pasa a `FavoriteButton`. */
export interface FavoriteState {
  signedIn: boolean;
  /** Si la entidad ya está en los favoritos de la cuenta (solo con sesión). */
  initial: boolean;
}

/**
 * Favoritos de la cuenta como entradas de la lista, o `null` sin sesión (o sin Comunidad): ahí la web sigue con
 * los de `localStorage`, como siempre.
 */
export async function accountFavorites(): Promise<SavedEntry[] | null> {
  const { enabled, user } = await getSession();
  if (!enabled || !user) return null;
  return (await getFavorites()).map(favoriteToEntry);
}

export async function favoriteState(kind: FavoriteKind, tag: string): Promise<FavoriteState> {
  const list = await accountFavorites();
  if (list === null) return { signedIn: false, initial: false };
  return { signedIn: true, initial: list.some((e) => e.type === kind && e.tag === tag) };
}
