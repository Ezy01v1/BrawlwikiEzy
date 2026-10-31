export interface SavedEntry {
  type: 'player' | 'club';
  tag: string;
  name?: string;
}

const RECENT_KEY = 'bw:recent';
const FAVORITES_KEY = 'bw:favorites';
export const MAX_RECENT = 10;

function isEntry(x: unknown): x is SavedEntry {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (e.type === 'player' || e.type === 'club') && typeof e.tag === 'string' && (e.name === undefined || typeof e.name === 'string');
}

function read(key: string): SavedEntry[] {
  try {
    const raw = window.localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: SavedEntry[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la app sigue funcionando sin recordar.
  }
}

const same = (a: SavedEntry, b: SavedEntry) => a.type === b.type && a.tag === b.tag;

export function getRecent(): SavedEntry[] {
  return read(RECENT_KEY);
}

export function addRecent(entry: SavedEntry): void {
  write(RECENT_KEY, [entry, ...getRecent().filter((e) => !same(e, entry))].slice(0, MAX_RECENT));
}

export function getFavorites(): SavedEntry[] {
  return read(FAVORITES_KEY);
}

/** Tras subirlos a la cuenta: con sesión los favoritos viven en la API. Los recientes no se tocan. */
export function clearFavorites(): void {
  try {
    window.localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** Reemplaza la lista: tras importar quedan solo los que no entraron en el envío. */
export function setFavorites(list: SavedEntry[]): void {
  write(FAVORITES_KEY, list);
}

export function isFavorite(entry: SavedEntry): boolean {
  return getFavorites().some((e) => same(e, entry));
}

export function toggleFavorite(entry: SavedEntry): boolean {
  const list = getFavorites();
  const on = list.some((e) => same(e, entry));
  write(FAVORITES_KEY, on ? list.filter((e) => !same(e, entry)) : [entry, ...list]);
  return !on;
}
