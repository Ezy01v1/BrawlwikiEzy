import { type Battle, type BattlePlayer, parseSupercellDate } from '@brawlwiki/shared';
import { brawlerImageUrl, mapImageUrl } from '../assets/urls';
import type { RawBattle, RawBattleLog, RawBattlePlayer } from '../supercell/types';
import { stripHash } from './common';

function toBattlePlayer(p: RawBattlePlayer): BattlePlayer {
  // Los duelos traen `brawlers[]` en lugar de `brawler`; mostramos el primero.
  const b = p.brawler ?? p.brawlers?.[0];
  return {
    tag: stripHash(p.tag),
    name: p.name,
    brawler: b
      ? { id: b.id, name: b.name, power: b.power, trophies: b.trophies, imageUrl: brawlerImageUrl(b.id) }
      : { id: 0, name: '?', power: 0, trophies: 0, imageUrl: null },
  };
}

function toBattle(item: RawBattle): Battle {
  const b = item.battle;
  // Showdown solo y duelos traen `players` sin equipos: cada jugador es su propio equipo.
  const teams = b.teams
    ? b.teams.map((team) => team.map(toBattlePlayer))
    : (b.players ?? []).map((p) => [toBattlePlayer(p)]);
  const mapId = item.event.id || null;

  return {
    battleTime: parseSupercellDate(item.battleTime),
    mode: b.mode ?? item.event.mode ?? 'unknown',
    type: b.type ?? null,
    map: { id: mapId, name: item.event.map ?? null, imageUrl: mapImageUrl(mapId) },
    result: b.result ?? null,
    rank: b.rank ?? null,
    trophyChange: b.trophyChange ?? null,
    durationSeconds: b.duration ?? null,
    starPlayerTag: b.starPlayer?.tag ? stripHash(b.starPlayer.tag) : null,
    teams,
  };
}

export function toBattles(raw: RawBattleLog): Battle[] {
  return raw.items.map(toBattle);
}
