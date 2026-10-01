import type { Battle, BattlePlayer, Player, PlayerBrawler } from '@brawlwiki/shared';

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

export function battlePlayer(tag: string, name: string, brawlerId: number, brawlerName: string, power = 11): BattlePlayer {
  return {
    tag,
    name,
    brawler: {
      id: brawlerId,
      name: brawlerName,
      power,
      trophies: 900,
      imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`,
    },
  };
}

const mapRef = (id: number, name: string) => ({ id, name, imageUrl: `https://cdn.brawlify.com/maps/regular/${id}.png` });

/** Misma forma que devuelve la API para el battle log de fixtures de #2PP. */
export const BATTLES: Battle[] = [
  {
    battleTime: '2026-09-29T11:55:00.000Z',
    mode: 'gemGrab',
    type: 'ranked',
    map: mapRef(15000026, 'Hard Rock Mine'),
    result: 'victory',
    rank: null,
    trophyChange: 8,
    durationSeconds: 121,
    starPlayerTag: '2PP',
    teams: [
      [
        battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY'),
        battlePlayer('8QU', 'SinClub', 16000001, 'COLT', 3),
        battlePlayer('Y2YY', 'Aliado', 16000002, 'BULL', 9),
      ],
      [
        battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10),
        battlePlayer('QQQ', 'Rival2', 16000000, 'SHELLY'),
        battlePlayer('LLQ', 'Rival3', 16000001, 'COLT'),
      ],
    ],
  },
  {
    battleTime: '2026-09-29T11:43:00.000Z',
    mode: 'brawlBall',
    type: 'ranked',
    map: mapRef(15000048, 'Super Beach'),
    result: 'defeat',
    rank: null,
    trophyChange: -6,
    durationSeconds: 150,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000002, 'BULL')], [battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10)]],
  },
  {
    battleTime: '2026-09-29T11:35:00.000Z',
    mode: 'soloShowdown',
    type: 'ranked',
    map: mapRef(15000011, 'Skull Creek'),
    result: null,
    rank: 2,
    trophyChange: 9,
    durationSeconds: null,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY')], [battlePlayer('QQQ', 'Rival2', 16000001, 'COLT')]],
  },
  {
    battleTime: '2026-09-29T11:20:00.000Z',
    mode: 'duels',
    type: 'friendly',
    map: { id: null, name: null, imageUrl: null },
    result: 'victory',
    rank: null,
    trophyChange: null,
    durationSeconds: 95,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY')], [battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10)]],
  },
];
