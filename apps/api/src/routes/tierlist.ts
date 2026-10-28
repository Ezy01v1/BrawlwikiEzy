import { type CommunityTierList, type Season, SaveTierListBodySchema, TierRowSchema } from '@brawlwiki/shared';
import { type Request, Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Cache } from '../cache/cache';
import type { CommunityDeps, TierStore } from '../community/router';
import { retryOnLockConflict } from '../community/retry';
import { dbCall } from '../community/sessions';
import { aggregate } from '../community/tiers';
import type { Db } from '../db/client';
import { seasons, tierVotes, users } from '../db/schema';
import { AppError } from '../errors';
import { requireAdmin, requireUser } from '../http/auth';
import { jsonBody } from '../http/json-body';
import { createUserLimiter } from '../http/rate-limit';
import { sendData } from '../http/respond';

const ACTIVE_TTL_SECONDS = 5 * 60;
const CLOSED_TTL_SECONDS = 24 * 60 * 60;
const VOTES_PER_MINUTE = 10;
const INSERT_BATCH = 100;

export const tierListKey = (seasonId: number) => `tierlist:${seasonId}`;

const SeasonBodySchema = z.object({ name: z.string().trim().min(1).max(64) }).strict();

/** Lo que se guarda en la caché: el agregado, sin la temporada (que se lee fresca en cada GET). */
const CachedAggregateSchema = z.object({
  voters: z.number(),
  rows: z.array(TierRowSchema),
  fetchedAt: z.number(),
});
type CachedAggregate = z.infer<typeof CachedAggregateSchema>;

type SeasonRow = typeof seasons.$inferSelect;

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  };
}

export function createTierStore(db: Db): TierStore {
  return {
    async listSeasons() {
      const rows = await dbCall(() => db.select().from(seasons).orderBy(desc(seasons.id)));
      return rows.map(toSeason);
    },
    async getSeason(id) {
      const [row] = await dbCall(() => db.select().from(seasons).where(eq(seasons.id, id)).limit(1));
      return row ? toSeason(row) : null;
    },
    async activeSeason() {
      const [row] = await dbCall(() =>
        db.select().from(seasons).where(isNull(seasons.endedAt)).orderBy(desc(seasons.id)).limit(1),
      );
      return row ? toSeason(row) : null;
    },
    async openSeason(name, now) {
      return dbCall(() =>
        retryOnLockConflict(() =>
          db.transaction(async (tx) => {
            // FOR UPDATE sobre las activas serializa dos POST simultáneos: el segundo ve (y cierra) la del primero.
            const [prev] = await tx
              .select({ id: seasons.id })
              .from(seasons)
              .where(isNull(seasons.endedAt))
              .orderBy(desc(seasons.id))
              .for('update');
            await tx.update(seasons).set({ endedAt: now }).where(isNull(seasons.endedAt));
            const [header] = await tx.insert(seasons).values({ name, startedAt: now });
            const season: Season = { id: header.insertId, name, startedAt: now.toISOString(), endedAt: null };
            return { season, closedId: prev?.id ?? null };
          }),
        ),
      );
    },
    async seasonVotes(seasonId) {
      return dbCall(() =>
        db
          .select({ userId: tierVotes.userId, brawlerId: tierVotes.brawlerId, tier: tierVotes.tier })
          .from(tierVotes)
          .where(eq(tierVotes.seasonId, seasonId)),
      );
    },
    async userVotes(seasonId, userId) {
      return dbCall(() =>
        db
          .select({ brawlerId: tierVotes.brawlerId, tier: tierVotes.tier })
          .from(tierVotes)
          .where(and(eq(tierVotes.seasonId, seasonId), eq(tierVotes.userId, userId)))
          .orderBy(tierVotes.brawlerId),
      );
    },
    async replaceVotes(userId, votes) {
      return dbCall(() =>
        retryOnLockConflict(() =>
          db.transaction(async (tx) => {
            // Bloquear la fila del usuario serializa sus guardados: dos PUT concurrentes no se mezclan
            // ni chocan en un deadlock entre los DELETE/INSERT; el último en entrar deja su lista completa.
            const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
            if (!user) throw new AppError('UNAUTHENTICATED');
            // FOR SHARE: si un admin está abriendo temporada, espera y vota en la nueva.
            const [active] = await tx
              .select({ id: seasons.id })
              .from(seasons)
              .where(isNull(seasons.endedAt))
              .orderBy(desc(seasons.id))
              .limit(1)
              .for('share');
            if (!active) return null;
            await tx.delete(tierVotes).where(and(eq(tierVotes.seasonId, active.id), eq(tierVotes.userId, userId)));
            for (let i = 0; i < votes.length; i += INSERT_BATCH) {
              await tx.insert(tierVotes).values(
                votes.slice(i, i + INSERT_BATCH).map((v) => ({
                  seasonId: active.id,
                  userId,
                  brawlerId: v.brawlerId,
                  tier: v.tier,
                })),
              );
            }
            return active.id;
          }),
        ),
      );
    },
  };
}

/** Caché tolerante a fallos: si Redis cae, se calcula igual (como safeGet/safeSet de cached-fetch). */
function tierListCache(cache: Cache) {
  const warn = (req: Request, err: unknown, key: string, op: string) =>
    req.log?.warn({ err, key }, `caché no disponible (${op})`);
  return {
    async get(req: Request, seasonId: number): Promise<CachedAggregate | undefined> {
      const key = tierListKey(seasonId);
      try {
        const parsed = CachedAggregateSchema.safeParse(await cache.get<unknown>(key));
        return parsed.success ? parsed.data : undefined;
      } catch (err) {
        warn(req, err, key, 'lectura');
        return undefined;
      }
    },
    async set(req: Request, seasonId: number, value: CachedAggregate, ttlSeconds: number): Promise<void> {
      const key = tierListKey(seasonId);
      try {
        await cache.set(key, value, ttlSeconds);
      } catch (err) {
        warn(req, err, key, 'escritura');
      }
    },
    async invalidate(req: Request, seasonId: number): Promise<void> {
      const key = tierListKey(seasonId);
      try {
        await cache.del(key);
      } catch (err) {
        warn(req, err, key, 'borrado');
      }
    },
  };
}

function userIdOf(req: Request): number {
  if (!req.user) throw new AppError('UNAUTHENTICATED');
  return req.user.id;
}

/** `?season=` opcional: entero positivo (hasta 9 dígitos, cabe en INT). */
function parseSeasonParam(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && /^[1-9]\d{0,8}$/.test(value)) return Number(value);
  throw new AppError('INVALID_PARAM', 'season debe ser el id de una temporada (entero positivo).');
}

/** Segundos enteros: DATETIME no guarda milisegundos y MySQL los redondearía. */
const nowToSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

/** `/seasons`: lista pública y apertura de temporada (solo admin). */
export function createSeasonsRouter(deps: CommunityDeps): Router {
  const store = deps.tiers ?? createTierStore(deps.db);
  const cache = tierListCache(deps.cache);
  const router = Router();

  router.get('/', async (_req, res) => {
    sendData(res, { data: await store.listSeasons(), source: 'fresh', fetchedAt: Date.now() });
  });

  // Solo requireAdmin: sin sesión también es "no admin" → 404, sin revelar la ruta.
  router.post('/', requireAdmin(), jsonBody('1kb'), async (req, res) => {
    const body = SeasonBodySchema.safeParse(req.body);
    if (!body.success) throw new AppError('INVALID_PARAM', 'Cuerpo inválido. Envía { "name": "1 a 64 caracteres" }.');
    const { season, closedId } = await store.openSeason(body.data.name, nowToSecond());
    // La cerrada estaba cacheada como activa (endedAt null, 5 min): se recalcula con su TTL de 24 h.
    if (closedId !== null) await cache.invalidate(req, closedId);
    res.status(201);
    sendData(res, { data: season, source: 'fresh', fetchedAt: Date.now() });
  });

  return router;
}

/** `/tierlist`: agregado público por temporada y la lista propia (ver y guardar). */
export function createTierListRouter(deps: CommunityDeps): Router {
  const store = deps.tiers ?? createTierStore(deps.db);
  const cache = tierListCache(deps.cache);
  // Una instancia por app: los tests no comparten contadores.
  const voteLimiter = createUserLimiter({ name: 'tierlist', perMinute: VOTES_PER_MINUTE });
  const router = Router();

  router.get('/', async (req, res) => {
    const param = parseSeasonParam(req.query.season);
    const season = param === undefined ? await store.activeSeason() : await store.getSeason(param);
    if (!season) {
      throw new AppError('NOT_FOUND', param === undefined ? 'No hay una temporada abierta.' : 'No existe esa temporada.');
    }
    let source: 'cache' | 'fresh' = 'cache';
    let agg = await cache.get(req, season.id);
    if (!agg) {
      source = 'fresh';
      agg = { ...aggregate(await store.seasonVotes(season.id)), fetchedAt: Date.now() };
      await cache.set(req, season.id, agg, season.endedAt === null ? ACTIVE_TTL_SECONDS : CLOSED_TTL_SECONDS);
    }
    const data: CommunityTierList = { season, voters: agg.voters, rows: agg.rows };
    sendData(res, { data, source, fetchedAt: agg.fetchedAt });
  });

  router.get('/me', requireUser(), async (req, res) => {
    const season = await store.activeSeason();
    if (!season) throw new AppError('NO_ACTIVE_SEASON');
    const votes = await store.userVotes(season.id, userIdOf(req));
    res.setHeader('Cache-Control', 'no-store');
    sendData(res, { data: { season, votes }, source: 'fresh', fetchedAt: Date.now() });
  });

  router.put('/me', requireUser(), voteLimiter, jsonBody('16kb'), async (req, res) => {
    const body = SaveTierListBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(
        'INVALID_PARAM',
        'Cuerpo inválido. Envía { "votes": [{ brawlerId, tier: 1..5 }] } con máximo 200 brawlers distintos.',
      );
    }
    if (!(await store.activeSeason())) throw new AppError('NO_ACTIVE_SEASON');
    const { votes } = body.data;
    if (votes.length > 0) {
      const known = await deps.brawlerIds();
      const unknown = votes.find((v) => !known.has(v.brawlerId));
      if (unknown) throw new AppError('INVALID_PARAM', `No existe un brawler con id ${unknown.brawlerId}.`);
    }
    // La transacción vuelve a mirar cuál es la activa: si justo se cerró, vota en la nueva o da 409.
    const seasonId = await store.replaceVotes(userIdOf(req), votes);
    if (seasonId === null) throw new AppError('NO_ACTIVE_SEASON');
    await cache.invalidate(req, seasonId);
    res.status(204).end();
  });

  return router;
}
