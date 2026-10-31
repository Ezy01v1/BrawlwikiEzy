import { type User, UserSchema } from '@brawlwiki/shared';
import { type Request, type Response, Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AccountStore, CommunityDeps } from '../community/router';
import { dbCall } from '../community/sessions';
import { requireUser, SESSION_COOKIE, sessionCookieOptions } from '../http/auth';
import { AppError } from '../errors';
import { jsonBody } from '../http/json-body';
import { parseTagParam } from '../http/params';
import { sendData } from '../http/respond';
import type { Db } from '../db/client';
import { tierVotes, users } from '../db/schema';
import { tierListCache } from './tierlist';

const PatchMeSchema = z.object({ playerTag: z.string().nullable() }).strict();

export function createAccountStore(db: Db): AccountStore {
  return {
    async setPlayerTag(userId, tag) {
      await dbCall(() => db.update(users).set({ playerTag: tag }).where(eq(users.id, userId)));
    },
    // Las FK con ON DELETE CASCADE se llevan sesiones, favoritos y votos. Antes se leen las temporadas
    // votadas, en la misma transacción, para invalidar sus agregados cacheados.
    async deleteUser(userId) {
      return dbCall(() =>
        db.transaction(async (tx) => {
          const voted = await tx
            .selectDistinct({ seasonId: tierVotes.seasonId })
            .from(tierVotes)
            .where(eq(tierVotes.userId, userId));
          await tx.delete(users).where(eq(users.id, userId));
          return voted.map((v) => v.seasonId);
        }),
      );
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
  const tierLists = tierListCache(deps.cache);
  const router = Router();

  // GET nunca responde 401: sin sesión → { user: null }.
  router.get('/', (req, res) => {
    sendUser(res, { user: req.user ? publicUser(req) : null });
  });

  router.patch('/', requireUser(), jsonBody('1kb'), async (req, res) => {
    const body = PatchMeSchema.safeParse(req.body);
    if (!body.success) throw new AppError('INVALID_PARAM', 'Cuerpo inválido. Envía { "playerTag": "#TAG" | null }.');
    const tag = body.data.playerTag === null ? null : parseTagParam(body.data.playerTag);
    const user = publicUser(req, tag);
    await accounts.setPlayerTag(user.id, tag);
    sendUser(res, { user });
  });

  router.delete('/', requireUser(), async (req, res) => {
    const votedSeasons = await accounts.deleteUser(publicUser(req).id);
    // Sus votos ya no cuentan: el agregado cacheado (5 min la activa, 24 h las cerradas) se recalcula.
    for (const seasonId of votedSeasons) await tierLists.invalidate(req, seasonId);
    const { maxAge: _m, ...opts } = sessionCookieOptions(config);
    res.clearCookie(SESSION_COOKIE, opts);
    res.status(204).end();
  });

  return router;
}
