import type { Player, PlayerBrawler } from '@brawlwiki/shared';
import { type BrawlerMetaMap, getBrawlerMeta } from '../assets/brawler-meta';
import { brawlerImageUrl, profileIconUrl } from '../assets/urls';
import type { RawPlayer, RawPlayerBrawler } from '../supercell/types';
import { named, stripHash } from './common';

function toPlayerBrawler(b: RawPlayerBrawler, meta?: BrawlerMetaMap): PlayerBrawler {
  const m = getBrawlerMeta(b.id, meta);
  return {
    id: b.id,
    name: b.name,
    power: b.power,
    rank: b.rank,
    trophies: b.trophies,
    highestTrophies: b.highestTrophies,
    gadgets: named(b.gadgets),
    starPowers: named(b.starPowers),
    gears: named(b.gears),
    imageUrl: brawlerImageUrl(b.id),
    rarity: m.rarity,
    class: m.class,
  };
}

export function toPlayer(raw: RawPlayer, meta?: BrawlerMetaMap): Player {
  return {
    tag: stripHash(raw.tag),
    name: raw.name,
    nameColor: raw.nameColor ?? null,
    icon: { id: raw.icon.id, imageUrl: profileIconUrl(raw.icon.id) },
    trophies: raw.trophies,
    highestTrophies: raw.highestTrophies,
    expLevel: raw.expLevel,
    victories: {
      trio: raw['3vs3Victories'] ?? 0,
      duo: raw.duoVictories ?? 0,
      solo: raw.soloVictories ?? 0,
    },
    club: raw.club?.tag && raw.club.name ? { tag: stripHash(raw.club.tag), name: raw.club.name } : null,
    brawlers: raw.brawlers.map((b) => toPlayerBrawler(b, meta)).sort((a, b) => b.trophies - a.trophies),
  };
}
