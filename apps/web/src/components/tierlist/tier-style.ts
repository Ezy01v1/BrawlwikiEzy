import type { TierLetter } from '@brawlwiki/shared';

/** Color de cada tier con los tokens del tema, sobre `surface-2` (todos ≥ 4.5:1 en claro y oscuro). */
export const TIER_BADGE: Record<TierLetter, string> = {
  S: 'border-primary text-primary',
  A: 'border-win text-win',
  B: 'border-info text-info',
  C: 'border-accent text-accent',
  D: 'border-loss text-loss',
};

/** "Pocos votos" en la tier list pública y "Sin ubicar" en el editor. */
export const UNTIERED_BADGE = 'border-border text-muted';
