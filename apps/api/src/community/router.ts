import { Router } from 'express';
import type { Cache } from '../cache/cache';
import type { Config } from '../config';
import type { Db } from '../db/client';
import type { SessionStore } from './sessions';

export interface CommunityDeps {
  db: Db;
  sessions: SessionStore;
  config: Config;
  brawlerIds(): Promise<Set<number>>;
  cache: Cache;
}

/** Router de Comunidad; loadUser y checkOrigin se montan delante en createApp. Las tareas 4–7 añaden rutas. */
export function createCommunityRouter(_deps: CommunityDeps): Router {
  return Router();
}
