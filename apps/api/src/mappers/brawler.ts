import type { Brawler } from '@brawlwiki/shared';
import { type BrawlerMetaMap, getBrawlerMeta } from '../assets/brawler-meta';
import { brawlerImageUrl } from '../assets/urls';
import type { RawBrawler, RawList } from '../supercell/types';
import { named } from './common';

export function toBrawler(raw: RawBrawler, meta?: BrawlerMetaMap): Brawler {
  const m = getBrawlerMeta(raw.id, meta);
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: brawlerImageUrl(raw.id),
    rarity: m.rarity,
    class: m.class,
    gadgets: named(raw.gadgets),
    starPowers: named(raw.starPowers),
  };
}

export function toBrawlers(raw: RawList<RawBrawler>, meta?: BrawlerMetaMap): Brawler[] {
  return raw.items.map((b) => toBrawler(b, meta)).sort((a, b) => a.id - b.id);
}
