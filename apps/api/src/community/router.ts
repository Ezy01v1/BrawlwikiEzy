import { Router } from 'express';
import type { Cache } from '../cache/cache';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { createAuthRouter } from '../routes/auth';
import { createMeRouter } from '../routes/me';
import type { DiscordProfile } from './discord';
import type { SessionStore } from './sessions';

/** Escrituras sobre la cuenta; por defecto usa la DB (se sustituye en tests sin DB). */
export interface AccountStore {
  setPlayerTag(userId: number, tag: string | null): Promise<void>;
  deleteUser(userId: number): Promise<void>;
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
}

/** Router de Comunidad; loadUser y checkOrigin se montan delante en createApp. Las tareas 4–7 añaden rutas. */
export function createCommunityRouter(deps: CommunityDeps): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(deps));
  router.use('/me', createMeRouter(deps));
  return router;
}
