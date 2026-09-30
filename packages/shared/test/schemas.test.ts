import { describe, expect, it } from 'vitest';
import {
  ApiErrorBodySchema,
  BattleSchema,
  envelopeSchema,
  PlayerSchema,
} from '../src/schemas';

const player = {
  tag: '2PP',
  name: 'EzyPlayer',
  nameColor: null,
  icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
  trophies: 42310,
  highestTrophies: 43002,
  expLevel: 187,
  victories: { trio: 3412, duo: 300, solo: 612 },
  club: null,
  brawlers: [
    {
      id: 16000000,
      name: 'SHELLY',
      power: 11,
      rank: 25,
      trophies: 750,
      highestTrophies: 800,
      gadgets: [{ id: 23000255, name: 'FAST FORWARD' }],
      starPowers: [],
      gears: [],
      imageUrl: null,
      rarity: null,
      class: null,
    },
  ],
};

describe('esquemas del contrato', () => {
  it('PlayerSchema acepta un jugador válido', () => {
    expect(PlayerSchema.parse(player)).toEqual(player);
  });

  it('PlayerSchema rechaza un tag con #', () => {
    expect(() => PlayerSchema.parse({ ...player, tag: '#2PP' })).toThrow();
  });

  it('envelopeSchema envuelve data + meta', () => {
    const Env = envelopeSchema(PlayerSchema);
    const body = {
      data: player,
      meta: { source: 'stale', fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 30 },
    };
    expect(Env.parse(body)).toEqual(body);
  });

  it('BattleSchema permite result y rank nulos (showdown)', () => {
    const battle = {
      battleTime: '2026-09-29T12:00:00.000Z',
      mode: 'soloShowdown',
      type: 'ranked',
      map: { id: null, name: null, imageUrl: null },
      result: null,
      rank: 2,
      trophyChange: 9,
      durationSeconds: null,
      starPlayerTag: null,
      teams: [[{ tag: '2PP', name: 'Ezy', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, imageUrl: null } }]],
    };
    expect(BattleSchema.parse(battle)).toEqual(battle);
  });

  it('ApiErrorBodySchema exige un código conocido', () => {
    expect(() =>
      ApiErrorBodySchema.parse({ error: { code: 'OOPS', message: 'x', requestId: 'r' } }),
    ).toThrow();
    expect(
      ApiErrorBodySchema.parse({ error: { code: 'NOT_FOUND', message: 'x', requestId: 'r' } }).error.code,
    ).toBe('NOT_FOUND');
  });
});
