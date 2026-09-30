export interface CachePolicy {
  /** Segundos durante los que el dato se sirve sin consultar a Supercell. */
  freshTtl: number;
  /** Segundos totales que el dato se conserva como respaldo (TTL real de la clave). */
  staleTtl: number;
}

const DAY = 86_400;

export const POLICIES = {
  player: { freshTtl: 120, staleTtl: 7 * DAY },
  battlelog: { freshTtl: 120, staleTtl: 7 * DAY },
  club: { freshTtl: 600, staleTtl: 7 * DAY },
  rankings: { freshTtl: 900, staleTtl: DAY },
  events: { freshTtl: 600, staleTtl: DAY },
  brawlers: { freshTtl: DAY, staleTtl: 30 * DAY },
} satisfies Record<string, CachePolicy>;

export const NEGATIVE_TTL_SECONDS = 60;
export const DEFAULT_COOLDOWN_SECONDS = 10;
