import {
  BattleSchema,
  BrawlerSchema,
  ClubRankingSchema,
  ClubSchema,
  EventSlotSchema,
  PlayerRankingSchema,
  PlayerSchema,
} from '@brawlwiki/shared';
import { describe, expect, it } from 'vitest';
import { toBattles } from '../src/mappers/battle';
import { toBrawlers } from '../src/mappers/brawler';
import { toClub } from '../src/mappers/club';
import { toEventSlots } from '../src/mappers/event';
import { toPlayer } from '../src/mappers/player';
import { toClubRankings, toPlayerRankings } from '../src/mappers/rankings';
import { createFixtureClient } from '../src/supercell/fixtures';

const sc = createFixtureClient();
const META = { '16000002': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Tank' } };

describe('toPlayer', () => {
  it('mapea el jugador 2PP y cumple el esquema', async () => {
    const p = toPlayer(await sc.getPlayer('2PP'), META);
    expect(PlayerSchema.parse(p)).toEqual(p);
    expect(p.tag).toBe('2PP');
    expect(p.club).toEqual({ tag: '2YPLQ', name: 'Los Cracks' });
    expect(p.victories).toEqual({ trio: 3412, duo: 300, solo: 612 });
    expect(p.icon.imageUrl).toBe('https://cdn.brawlify.com/profile-icons/regular/28000000.png');
    expect(p.brawlers.map((b) => b.name)).toEqual(['BULL', 'SHELLY', 'COLT', 'BROCK']);
    expect(p.brawlers[0]).toMatchObject({
      imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000002.png',
      rarity: { name: 'Rare', color: '#68fd58' },
      class: 'Tank',
    });
    expect(p.brawlers[1]!.gears).toEqual([{ id: 62000000, name: 'SPEED' }]);
  });

  it('jugador sin club ("club": {}) → club null; campos opcionales ausentes → vacíos', async () => {
    const p = toPlayer(await sc.getPlayer('8QU'), META);
    expect(PlayerSchema.parse(p)).toEqual(p);
    expect(p.club).toBeNull();
    expect(p.nameColor).toBeNull();
    expect(p.brawlers[0]).toMatchObject({ gadgets: [], starPowers: [], gears: [], rarity: null, class: null });
  });
});

describe('toBattles', () => {
  it('mapea 3vs3, showdown solo y duelos sin romper y cumple el esquema', async () => {
    const battles = toBattles(await sc.getBattleLog('2PP'));
    expect(battles).toHaveLength(4);
    for (const b of battles) expect(BattleSchema.parse(b)).toEqual(b);

    const [gem, ball, showdown, duel] = battles;
    expect(gem).toMatchObject({
      battleTime: '2026-09-29T11:55:00.000Z',
      mode: 'gemGrab',
      map: { id: 15000026, name: 'Hard Rock Mine', imageUrl: 'https://cdn.brawlify.com/maps/regular/15000026.png' },
      result: 'victory',
      trophyChange: 8,
      durationSeconds: 121,
      starPlayerTag: '2PP',
    });
    expect(gem!.teams.map((t) => t.length)).toEqual([3, 3]);
    expect(ball).toMatchObject({ result: 'defeat', trophyChange: -6, starPlayerTag: null });

    expect(showdown).toMatchObject({ mode: 'soloShowdown', rank: 2, result: null, durationSeconds: null });
    expect(showdown!.teams).toHaveLength(2);
    expect(showdown!.teams[0]).toHaveLength(1);

    expect(duel).toMatchObject({
      mode: 'duels',
      map: { id: null, name: null, imageUrl: null },
      trophyChange: null,
      rank: null,
    });
    expect(duel!.teams[0]![0]!.brawler.name).toBe('SHELLY');
  });

  it('battle log vacío → []', async () => {
    expect(toBattles(await sc.getBattleLog('8QU'))).toEqual([]);
  });
});

describe('toClub', () => {
  it('mapea el club y ordena miembros por trofeos', async () => {
    const c = toClub(await sc.getClub('2YPLQ'));
    expect(ClubSchema.parse(c)).toEqual(c);
    expect(c.tag).toBe('2YPLQ');
    expect(c.badgeImageUrl).toBe('https://cdn.brawlify.com/club-badges/regular/8000000.png');
    expect(c.members.map((m) => m.tag)).toEqual(['2PP', 'Y2YY', '8QU']);
    expect(c.members[1]!.nameColor).toBeNull();
  });
});

describe('rankings', () => {
  it('jugadores: clubName null si no hay club', async () => {
    const r = toPlayerRankings(await sc.getPlayerRankings('global', 200));
    for (const x of r) expect(PlayerRankingSchema.parse(x)).toEqual(x);
    expect(r[0]).toMatchObject({ rank: 1, tag: 'YYYY', clubName: 'Tribe' });
    expect(r[2]!.clubName).toBeNull();
  });

  it('clubes', async () => {
    const r = toClubRankings(await sc.getClubRankings('global', 200));
    for (const x of r) expect(ClubRankingSchema.parse(x)).toEqual(x);
    expect(r[1]).toMatchObject({ rank: 2, tag: '8CGRV', memberCount: 27 });
  });
});

describe('brawlers y eventos', () => {
  it('toBrawlers agrega imagen y meta', async () => {
    const list = toBrawlers(await sc.getBrawlers(), META);
    for (const b of list) expect(BrawlerSchema.parse(b)).toEqual(b);
    expect(list.map((b) => b.id)).toEqual([16000000, 16000001, 16000002, 16000003]);
    expect(list[2]).toMatchObject({ rarity: { name: 'Rare' }, class: 'Tank' });
    expect(list[0]!.gadgets).toEqual([{ id: 23000255, name: 'FAST FORWARD' }]);
  });

  it('toEventSlots convierte fechas y deja mode.imageUrl en null', async () => {
    const slots = toEventSlots(await sc.getEventRotation());
    for (const s of slots) expect(EventSlotSchema.parse(s)).toEqual(s);
    expect(slots[0]).toMatchObject({
      slotId: 1,
      startTime: '2026-09-29T08:00:00.000Z',
      mode: { name: 'gemGrab', imageUrl: null },
      map: { id: 15000026, name: 'Hard Rock Mine' },
    });
  });
});
