import type { PlayerBrawler } from '@brawlwiki/shared';

export const BRAWLER_ORDERS = ['trofeos', 'poder', 'nombre'] as const;
export type BrawlerOrder = (typeof BRAWLER_ORDERS)[number];

export function parseOrder(value: string | undefined): BrawlerOrder {
  return (BRAWLER_ORDERS as readonly string[]).includes(value ?? '') ? (value as BrawlerOrder) : 'trofeos';
}

const byName = (a: PlayerBrawler, b: PlayerBrawler) => a.name.localeCompare(b.name, 'es');

export function sortBrawlers(list: PlayerBrawler[], order: BrawlerOrder): PlayerBrawler[] {
  const copy = [...list];
  if (order === 'nombre') return copy.sort(byName);
  if (order === 'poder') return copy.sort((a, b) => b.power - a.power || b.trophies - a.trophies || byName(a, b));
  return copy.sort((a, b) => b.trophies - a.trophies || byName(a, b));
}
