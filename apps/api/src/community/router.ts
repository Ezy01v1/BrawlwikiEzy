import type { Favorite, Season } from '@brawlwiki/shared';
import { Router } from 'express';
import type { Cache } from '../cache/cache';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { createAuthRouter } from '../routes/auth';
import { createFavoritesRouter } from '../routes/favorites';
import { createMeRouter } from '../routes/me';
import { createSeasonsRouter, createTierListRouter } from '../routes/tierlist';
import type { DiscordProfile } from './discord';
import type { SessionStore } from './sessions';
import type { VoteRow } from './tiers';

/** Escrituras sobre la cuenta; por defecto usa la DB (se sustituye en tests sin DB). */
export interface AccountStore {
  setPlayerTag(userId: number, tag: string | null): Promise<void>;
  deleteUser(userId: number): Promise<void>;
}

/** Favoritos del usuario; por defecto usa la DB (se sustituye en tests sin DB). */
export interface FavoriteStore {
  /** Más recientes primero. */
  list(userId: number): Promise<Favorite[]>;
  /** INSERT IGNORE: si ya existe, no hace nada (no pisa el nombre). */
  add(userId: number, item: { kind: Favorite['kind']; tag: string; name: string }): Promise<void>;
  /** Idempotente: borrar algo que no existe no es un error. */
  remove(userId: number, kind: Favorite['kind'], tag: string): Promise<void>;
  /** INSERT IGNORE por lote; devuelve cuántos eran nuevos. */
  importMany(userId: number, items: { kind: Favorite['kind']; tag: string; name: string }[]): Promise<number>;
}

export interface TierVote {
  brawlerId: number;
  tier: number;
}

/** Temporadas y votos; por defecto usa la DB (se sustituye en tests sin DB). */
export interface TierStore {
  /** La más nueva primero. */
  listSeasons(): Promise<Season[]>;
  getSeason(id: number): Promise<Season | null>;
  activeSeason(): Promise<Season | null>;
  /** En una transacción: cierra la activa (si hay) y abre otra. */
  openSeason(name: string, now: Date): Promise<{ season: Season; closedId: number | null }>;
  seasonVotes(seasonId: number): Promise<VoteRow[]>;
  /** Ordenados por brawlerId. */
  userVotes(seasonId: number, userId: number): Promise<TierVote[]>;
  /**
   * En una transacción: reemplaza todos los votos del usuario en la temporada activa.
   * Devuelve el id de esa temporada, o null si no hay activa (y no escribe nada).
   */
  replaceVotes(userId: number, votes: TierVote[]): Promise<number | null>;
}

export interface CommunityDeps {
  db: Db;
  sessions: SessionStore;
  config: Config;
  brawlerIds(): Promise<Set<number>>;
  cache: Cache;
  /** Para tests: fetch falso hacia Discord. */
  fetchImpl?: typeof fetch;
  /** Para tests sin DB: sustituye a upsertDiscordUser. */
  upsertUser?(profile: DiscordProfile): Promise<number>;
  /** Para tests sin DB: sustituye a las escrituras de /me. */
  accounts?: AccountStore;
  /** Para tests sin DB: sustituye a las escrituras de /me/favorites. */
  favorites?: FavoriteStore;
  /** Para tests sin DB: sustituye a temporadas y votos. */
  tiers?: TierStore;
}

/** Router de Comunidad; loadUser y checkOrigin se montan delante en createApp. */
export function createCommunityRouter(deps: CommunityDeps): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(deps));
  // Antes que /me para que /me/favorites/* no pase por el router de /me.
  router.use('/me/favorites', createFavoritesRouter(deps));
  router.use('/me', createMeRouter(deps));
  router.use('/seasons', createSeasonsRouter(deps));
  router.use('/tierlist', createTierListRouter(deps));
  return router;
}
