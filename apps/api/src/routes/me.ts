import { type User, UserSchema } from '@brawlwiki/shared';
import express, { type Request, type Response, Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AccountStore, CommunityDeps } from '../community/router';
import { dbCall } from '../community/sessions';
import { requireUser, SESSION_COOKIE, sessionCookieOptions } from '../http/auth';
import { AppError } from '../errors';
import { parseTagParam } from '../http/params';
import { sendData } from '../http/respond';
import type { Db } from '../db/client';
import { users } from '../db/schema';

const PatchMeSchema = z.object({ playerTag: z.string().nullable() }).strict();

export function createAccountStore(db: Db): AccountStore {
  return {
    async setPlayerTag(userId, tag) {
      await dbCall(() => db.update(users).set({ playerTag: tag }).where(eq(users.id, userId)));
    },
    // Las FK con ON DELETE CASCADE se llevan sesiones, favoritos y votos.
    async deleteUser(userId) {
      await dbCall(() => db.delete(users).where(eq(users.id, userId)));
    },
  };
}

/** Usuario público (sin discordId) a partir de la sesión. */
function publicUser(req: Request, playerTag: string | null = req.user?.playerTag ?? null): User {
  const u = req.user;
  if (!u) throw new AppError('UNAUTHENTICATED');
  return UserSchema.parse({
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    playerTag,
    isAdmin: u.isAdmin,
  });
}

function sendUser(res: Response, data: { user: User | null }): void {
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, { data, source: 'fresh', fetchedAt: Date.now() });
}

export function createMeRouter(deps: CommunityDeps): Router {
  const { config } = deps;
  const accounts = deps.accounts ?? createAccountStore(deps.db);
  const router = Router();

  // GET nunca responde 401: sin sesión → { user: null }.
  router.get('/', (req, res) => {
    sendUser(res, { user: req.user ? publicUser(req) : null });
  });

  router.patch('/', requireUser(), express.json({ limit: '1kb' }), async (req, res) => {
    const body = PatchMeSchema.safeParse(req.body);
    if (!body.success) throw new AppError('INVALID_PARAM', 'Cuerpo inválido. Envía { "playerTag": "#TAG" | null }.');
    const tag = body.data.playerTag === null ? null : parseTagParam(body.data.playerTag);
    const user = publicUser(req, tag);
    await accounts.setPlayerTag(user.id, tag);
    sendUser(res, { user });
  });

  router.delete('/', requireUser(), async (req, res) => {
    await accounts.deleteUser(publicUser(req).id);
    const { maxAge: _m, ...opts } = sessionCookieOptions(config);
    res.clearCookie(SESSION_COOKIE, opts);
    res.status(204).end();
  });

  return router;
}
