import type { PlayerBrawler } from '@brawlwiki/shared';
import { displayName } from './format';

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

/** Copia ordenada por el nombre que ve el usuario ("8-Bit", "El Primo", "Shelly"). */
export function sortByDisplayName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'es'));
}
