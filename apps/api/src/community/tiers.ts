import type { TierLetter, TierRow } from '@brawlwiki/shared';

/** Con menos votos que esto el brawler queda en "Pocos votos" (tier null). */
export const MIN_VOTES = 5;
/** Solo cuentan los usuarios que ubicaron al menos esta cantidad de brawlers. */
export const MIN_RATED_PER_USER = 10;

/** Cortes fijos sobre el promedio (S=5 … D=1); por debajo del último, D. */
const CUTOFFS: readonly (readonly [TierLetter, number])[] = [
  ['S', 4.5],
  ['A', 3.5],
  ['B', 2.5],
  ['C', 1.5],
];

export function tierFor(average: number, votes: number): TierLetter | null {
  if (votes < MIN_VOTES) return null;
  for (const [letter, min] of CUTOFFS) if (average >= min) return letter;
  return 'D';
}

export interface VoteRow {
  userId: number;
  brawlerId: number;
  tier: number;
}

/**
 * Tier list de la comunidad a partir de los votos de una temporada.
 * Descarta primero a los usuarios con menos de MIN_RATED_PER_USER votos; el promedio se
 * redondea a 2 decimales y el tier sale del promedio redondeado (lo que se muestra es lo que decide).
 * Orden: promedio desc y, a igual promedio, brawlerId asc.
 */
export function aggregate(rows: readonly VoteRow[]): { voters: number; rows: TierRow[] } {
  const perUser = new Map<number, number>();
  for (const r of rows) perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + 1);

  const totals = new Map<number, { sum: number; count: number }>();
  for (const r of rows) {
    if ((perUser.get(r.userId) ?? 0) < MIN_RATED_PER_USER) continue;
    const t = totals.get(r.brawlerId) ?? { sum: 0, count: 0 };
    t.sum += r.tier;
    t.count += 1;
    totals.set(r.brawlerId, t);
  }

  let voters = 0;
  for (const n of perUser.values()) if (n >= MIN_RATED_PER_USER) voters++;

  const out: TierRow[] = [];
  for (const [brawlerId, { sum, count }] of totals) {
    // sum y count son enteros: un .5 exacto en sum*100/count es representable, así que no hay error de redondeo.
    const average = Math.round((sum * 100) / count) / 100;
    out.push({ brawlerId, tier: tierFor(average, count), average, votes: count });
  }
  out.sort((a, b) => b.average - a.average || a.brawlerId - b.brawlerId);
  return { voters, rows: out };
}
