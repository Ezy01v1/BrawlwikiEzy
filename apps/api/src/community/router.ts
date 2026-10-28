import type { Favorite } from '@brawlwiki/shared';
import { Router } from 'express';
import type { Cache } from '../cache/cache';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { createAuthRouter } from '../routes/auth';
import { createFavoritesRouter } from '../routes/favorites';
import { createMeRouter } from '../routes/me';
import type { DiscordProfile } from './discord';
import type { SessionStore } from './sessions';

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
}

/** Router de Comunidad; loadUser y checkOrigin se montan delante en createApp. Las tareas 4–7 añaden rutas. */
export function createCommunityRouter(deps: CommunityDeps): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(deps));
  // Antes que /me para que /me/favorites/* no pase por el router de /me.
  router.use('/me/favorites', createFavoritesRouter(deps));
  router.use('/me', createMeRouter(deps));
  return router;
}
