import { TIER_VALUES, type TierLetter } from '@brawlwiki/shared';
import type { ActionErrorCode } from './account';

/** Lo que la API acepta y devuelve: S=5 … D=1. Un brawler sin voto ("Sin ubicar") no se manda. */
export type TierValue = 1 | 2 | 3 | 4 | 5;
export interface TierVote {
  brawlerId: number;
  tier: number;
}
/** brawlerId → tier. Solo los ubicados. */
export type TierVotes = Record<number, TierValue>;

export type SaveTierListResult = { ok: true } | { ok: false; code: ActionErrorCode; retryAfter?: number };

/** S → D, de mayor a menor. */
export const TIER_OPTIONS = (Object.entries(TIER_VALUES) as [TierLetter, TierValue][]).map(([letter, value]) => ({
  letter,
  value,
}));

export const UNPLACED_LABEL = 'Sin ubicar';
/** Solo cuentan los votantes con al menos 10 brawlers ubicados (spec, cortes de la tier list). */
export const MIN_PLACED = 10;

export function tierLetter(value: number): TierLetter | null {
  return TIER_OPTIONS.find((o) => o.value === value)?.letter ?? null;
}

const isTierValue = (v: unknown): v is TierValue => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

/** Votos de la API → mapa, sin ids que el catálogo no conoce (la API los rechazaría al guardar). */
export function votesFromList(list: TierVote[], known: ReadonlySet<number>): TierVotes {
  const out: TierVotes = {};
  for (const v of list) if (known.has(v.brawlerId) && isTierValue(v.tier)) out[v.brawlerId] = v.tier;
  return out;
}

/** Mapa → lista para la API, ordenada por id (estable para comparar y para los tests). */
export function votesToList(votes: TierVotes): TierVote[] {
  return Object.entries(votes)
    .map(([id, tier]) => ({ brawlerId: Number(id), tier }))
    .sort((a, b) => a.brawlerId - b.brawlerId);
}

export function sameVotes(a: TierVotes, b: TierVotes): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[Number(k)] === b[Number(k)]);
}

export const draftKey = (seasonId: number) => `bw:tier-draft:${seasonId}`;

/**
 * Borrador guardado en `sessionStorage`. Si no es un objeto (JSON roto, lista, número) se ignora entero;
 * de un objeto se descartan los ids desconocidos y los tiers inválidos.
 */
export function parseDraft(raw: string | null, known: ReadonlySet<number>): TierVotes | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const out: TierVotes = {};
  for (const [key, tier] of Object.entries(value)) {
    if (!/^[1-9]\d{0,9}$/.test(key)) continue;
    const id = Number(key);
    if (known.has(id) && isTierValue(tier)) out[id] = tier;
  }
  return out;
}

export function readDraft(seasonId: number, known: ReadonlySet<number>): TierVotes | null {
  try {
    return parseDraft(window.sessionStorage.getItem(draftKey(seasonId)), known);
  } catch {
    return null;
  }
}

export function writeDraft(seasonId: number, votes: TierVotes): void {
  try {
    window.sessionStorage.setItem(draftKey(seasonId), JSON.stringify(votes));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): el editor funciona igual, sin borrador.
  }
}

export function clearDraft(seasonId: number): void {
  try {
    window.sessionStorage.removeItem(draftKey(seasonId));
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}
