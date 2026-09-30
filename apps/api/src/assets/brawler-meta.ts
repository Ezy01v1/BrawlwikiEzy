import { readFileSync } from 'node:fs';
import type { Rarity } from '@brawlwiki/shared';

export interface BrawlerMeta {
  rarity: Rarity | null;
  class: string | null;
}
export type BrawlerMetaMap = Record<string, BrawlerMeta>;

const NONE: BrawlerMeta = { rarity: null, class: null };
let loaded: BrawlerMetaMap | undefined;

export function loadBrawlerMeta(): BrawlerMetaMap {
  loaded ??= JSON.parse(readFileSync(new URL('./brawler-meta.json', import.meta.url), 'utf8')) as BrawlerMetaMap;
  return loaded;
}

export function getBrawlerMeta(id: number, map: BrawlerMetaMap = loadBrawlerMeta()): BrawlerMeta {
  return map[String(id)] ?? NONE;
}

interface BrawlifyBrawler {
  id?: unknown;
  rarity?: { name?: string; color?: string } | null;
  class?: { name?: string } | null;
}

/** Convierte el JSON de https://api.brawlify.com/v1/brawlers (descargado desde el navegador) a nuestro mapa. */
export function convertBrawlifyBrawlers(json: unknown): BrawlerMetaMap {
  const list = (json as { list?: unknown } | null)?.list;
  if (!Array.isArray(list)) {
    throw new Error('El JSON no tiene la forma { list: [...] } de Brawlify /v1/brawlers');
  }
  const out: BrawlerMetaMap = {};
  for (const b of list as BrawlifyBrawler[]) {
    if (typeof b.id !== 'number') continue;
    out[String(b.id)] = {
      rarity: b.rarity?.name && b.rarity.color ? { name: b.rarity.name, color: b.rarity.color } : null,
      class: b.class?.name ?? null,
    };
  }
  return out;
}
