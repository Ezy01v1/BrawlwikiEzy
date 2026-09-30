import { readFileSync } from 'node:fs';
import { AppError } from '../errors';
import type { RawBattleLog, RawClub, RawPlayer, SupercellApi } from './types';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as T;
}

const PLAYERS = new Set(['2PP', '8QU']);
const CLUBS = new Set(['2YPLQ', '8CGRV']);
const BATTLELOGS = new Set(['2PP']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cliente falso para tests, E2E y desarrollo sin key. Ver la tabla de tags en la spec (sección 3). */
export function createFixtureClient(opts: { slowMs?: number } = {}): SupercellApi {
  const slowMs = opts.slowMs ?? 4000;

  async function scenario(tag: string): Promise<string> {
    if (tag === 'RRRR') throw new AppError('UPSTREAM_RATE_LIMITED', undefined, { retryAfter: 10 });
    if (tag === 'LLLL') throw new AppError('UPSTREAM_MAINTENANCE');
    if (tag === 'GGGG') {
      await sleep(slowMs);
      return '2PP';
    }
    return tag;
  }

  return {
    mode: 'mock',
    async getPlayer(tag) {
      const source = await scenario(tag);
      if (!PLAYERS.has(source)) throw new AppError('NOT_FOUND');
      return { ...load<RawPlayer>(`player-${source}`), tag: `#${tag}` };
    },
    async getBattleLog(tag) {
      const source = await scenario(tag);
      if (!PLAYERS.has(source)) throw new AppError('NOT_FOUND');
      return BATTLELOGS.has(source) ? load<RawBattleLog>(`battlelog-${source}`) : { items: [] };
    },
    async getClub(tag) {
      const source = await scenario(tag);
      if (!CLUBS.has(source)) throw new AppError('NOT_FOUND');
      return load<RawClub>(`club-${source}`);
    },
    getPlayerRankings: async () => load('rankings-players'),
    getClubRankings: async () => load('rankings-clubs'),
    getBrawlerRankings: async () => load('rankings-players'),
    getBrawlers: async () => load('brawlers'),
    getEventRotation: async () => load('events'),
  };
}
