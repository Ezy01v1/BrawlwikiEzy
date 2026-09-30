import type { Battle, Brawler, Club, ClubRanking, EventSlot, Player, PlayerRanking } from '@brawlwiki/shared';
import type { BrawlerMetaMap } from './assets/brawler-meta';
import type { CachedFetch } from './cache/cached-fetch';
import { POLICIES } from './cache/policies';
import { AppError, isAppError } from './errors';
import { toBattles } from './mappers/battle';
import { toBrawlers } from './mappers/brawler';
import { toClub } from './mappers/club';
import { toEventSlots } from './mappers/event';
import { toPlayer } from './mappers/player';
import { toClubRankings, toPlayerRankings } from './mappers/rankings';
import type { SupercellApi } from './supercell/types';
import type { DataResult } from './types';

export interface RequestContext {
  beforeUpstream?: () => void;
}

export interface Services {
  player(tag: string, ctx?: RequestContext): Promise<DataResult<Player>>;
  battleLog(tag: string, ctx?: RequestContext): Promise<DataResult<Battle[]>>;
  club(tag: string, ctx?: RequestContext): Promise<DataResult<Club>>;
  playerRankings(region: string, limit: number, ctx?: RequestContext): Promise<DataResult<PlayerRanking[]>>;
  clubRankings(region: string, limit: number, ctx?: RequestContext): Promise<DataResult<ClubRanking[]>>;
  brawlerRankings(
    brawlerId: number,
    region: string,
    limit: number,
    ctx?: RequestContext,
  ): Promise<DataResult<PlayerRanking[]>>;
  brawlers(ctx?: RequestContext): Promise<DataResult<Brawler[]>>;
  brawler(id: number, ctx?: RequestContext): Promise<DataResult<Brawler>>;
  eventRotation(ctx?: RequestContext): Promise<DataResult<EventSlot[]>>;
}

export const RANKING_FETCH_LIMIT = 200;

/** Prefijo de versión: si cambia la forma de un DTO, se sube a v2 y la caché vieja se ignora. */
const key = (k: string) => `v1:${k}`;

async function notFoundAs<T>(message: string, p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isAppError(e) && e.code === 'NOT_FOUND') throw new AppError('NOT_FOUND', message);
    throw e;
  }
}

const sliced = <T>(r: DataResult<T[]>, limit: number): DataResult<T[]> => ({ ...r, data: r.data.slice(0, limit) });

export function createServices(deps: {
  supercell: SupercellApi;
  cachedFetch: CachedFetch;
  brawlerMeta?: BrawlerMetaMap;
}): Services {
  const { supercell: sc, cachedFetch, brawlerMeta } = deps;

  const brawlers: Services['brawlers'] = (ctx = {}) =>
    cachedFetch(key('brawlers'), POLICIES.brawlers, async () => toBrawlers(await sc.getBrawlers(), brawlerMeta), ctx);

  return {
    player: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un jugador con ese tag.',
        cachedFetch(key(`player:${tag}`), POLICIES.player, async () => toPlayer(await sc.getPlayer(tag), brawlerMeta), ctx),
      ),
    battleLog: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un jugador con ese tag.',
        cachedFetch(key(`battlelog:${tag}`), POLICIES.battlelog, async () => toBattles(await sc.getBattleLog(tag)), ctx),
      ),
    club: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un club con ese tag.',
        cachedFetch(key(`club:${tag}`), POLICIES.club, async () => toClub(await sc.getClub(tag)), ctx),
      ),
    playerRankings: async (region, limit, ctx = {}) =>
      sliced(
        await cachedFetch(
          key(`rank:players:${region}`),
          POLICIES.rankings,
          async () => toPlayerRankings(await sc.getPlayerRankings(region, RANKING_FETCH_LIMIT)),
          ctx,
        ),
        limit,
      ),
    clubRankings: async (region, limit, ctx = {}) =>
      sliced(
        await cachedFetch(
          key(`rank:clubs:${region}`),
          POLICIES.rankings,
          async () => toClubRankings(await sc.getClubRankings(region, RANKING_FETCH_LIMIT)),
          ctx,
        ),
        limit,
      ),
    brawlerRankings: async (brawlerId, region, limit, ctx = {}) =>
      sliced(
        await notFoundAs(
          'No existe un brawler con ese id.',
          cachedFetch(
            key(`rank:brawler:${brawlerId}:${region}`),
            POLICIES.rankings,
            async () => toPlayerRankings(await sc.getBrawlerRankings(region, brawlerId, RANKING_FETCH_LIMIT)),
            ctx,
          ),
        ),
        limit,
      ),
    brawlers,
    brawler: async (id, ctx = {}) => {
      const list = await brawlers(ctx);
      const found = list.data.find((b) => b.id === id);
      if (!found) throw new AppError('NOT_FOUND', 'No existe un brawler con ese id.');
      return { ...list, data: found };
    },
    eventRotation: (ctx = {}) =>
      cachedFetch(key('events'), POLICIES.events, async () => toEventSlots(await sc.getEventRotation()), ctx),
  };
}
