import type { Player, PlayerBrawler } from '@brawlwiki/shared';

export function brawler(overrides: Partial<PlayerBrawler> = {}): PlayerBrawler {
  return {
    id: 16000000,
    name: 'SHELLY',
    power: 11,
    rank: 30,
    trophies: 900,
    highestTrophies: 950,
    gadgets: [],
    starPowers: [],
    gears: [],
    imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000000.png',
    rarity: null,
    class: null,
    ...overrides,
  };
}

export const PLAYER: Player = {
  tag: '2PP',
  name: 'EzyPlayer',
  nameColor: null,
  icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
  trophies: 42310,
  highestTrophies: 43002,
  expLevel: 187,
  victories: { trio: 3412, duo: 300, solo: 612 },
  club: { tag: '2YPLQ', name: 'Los Cracks' },
  brawlers: [
    brawler({ id: 16000002, name: 'BULL', trophies: 1000, power: 11, rarity: { name: 'Rare', color: '#68fd58' } }),
    brawler({ id: 16000000, name: 'SHELLY', trophies: 900, power: 11 }),
    brawler({ id: 16000001, name: 'COLT', trophies: 750, power: 9 }),
    brawler({ id: 16000003, name: 'BROCK', trophies: 500, power: 7 }),
  ],
};
