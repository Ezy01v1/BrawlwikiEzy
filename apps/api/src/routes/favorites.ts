import { type Favorite, FavoriteKindSchema, ImportFavoritesBodySchema } from '@brawlwiki/shared';
import express, { type RequestHandler, Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { CommunityDeps, FavoriteStore } from '../community/router';
import { dbCall } from '../community/sessions';
import type { Db } from '../db/client';
import { favorites } from '../db/schema';
import { AppError } from '../errors';
import { requireUser } from '../http/auth';
import { parseTagParam } from '../http/params';
import { sendData } from '../http/respond';

const NAME_MAX = 64;
const PutBodySchema = z.object({ name: z.string().trim().min(1).max(NAME_MAX) }).strict();

type Row = typeof favorites.$inferSelect;

function toFavorite(row: Row): Favorite {
  return { kind: row.kind, tag: row.tag, name: row.name, createdAt: row.createdAt.toISOString() };
}

export function createFavoriteStore(db: Db): FavoriteStore {
  const key = (userId: number, kind: Favorite['kind'], tag: string) =>
    and(eq(favorites.userId, userId), eq(favorites.kind, kind), eq(favorites.tag, tag));
  return {
    async list(userId) {
      const rows = await dbCall(() =>
        db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt), favorites.tag),
      );
      return rows.map(toFavorite);
    },
    async add(userId, item) {
      await dbCall(() => db.insert(favorites).ignore().values({ userId, ...item }));
    },
    async remove(userId, kind, tag) {
      await dbCall(() => db.delete(favorites).where(key(userId, kind, tag)));
    },
    async importMany(userId, items) {
      if (items.length === 0) return 0;
      const [header] = await dbCall(() =>
        db
          .insert(favorites)
          .ignore()
          .values(items.map((item) => ({ userId, ...item }))),
      );
      // Con INSERT IGNORE, affectedRows cuenta solo las filas realmente insertadas.
      return header.affectedRows;
    },
  };
}

function parseKind(value: unknown): Favorite['kind'] {
  const kind = FavoriteKindSchema.safeParse(value);
  if (!kind.success) throw new AppError('INVALID_PARAM', 'kind debe ser "player" o "club".');
  return kind.data;
}

/** express.json con límite; un cuerpo demasiado grande (413) se informa como 400 INVALID_PARAM. */
function jsonBody(limit: string): RequestHandler {
  const parser = express.json({ limit });
  return (req, res, next) =>
    parser(req, res, (err?: unknown) => {
      const type = (err as { type?: unknown } | null | undefined)?.type;
      next(type === 'entity.too.large' ? new AppError('INVALID_PARAM', 'Cuerpo demasiado grande.') : err);
    });
}

function userIdOf(req: express.Request): number {
  if (!req.user) throw new AppError('UNAUTHENTICATED');
  return req.user.id;
}

export function createFavoritesRouter(deps: CommunityDeps): Router {
  const store = deps.favorites ?? createFavoriteStore(deps.db);
  const router = Router();
  router.use(requireUser());

  router.get('/', async (req, res) => {
    const list = await store.list(userIdOf(req));
    res.setHeader('Cache-Control', 'no-store');
    sendData(res, { data: { favorites: list }, source: 'fresh', fetchedAt: Date.now() });
  });

  // Antes de /:kind/:tag para que "import" no se confunda con un kind.
  router.post('/import', jsonBody('32kb'), async (req, res) => {
    const body = ImportFavoritesBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError('INVALID_PARAM', 'Cuerpo inválido. Envía { "items": [{ kind, tag, name }] } con máximo 100 ítems.');
    }
    // Cada tag se valida en el servidor; uno inválido rechaza todo el envío.
    const seen = new Set<string>();
    const items: { kind: Favorite['kind']; tag: string; name: string }[] = [];
    for (const raw of body.data.items) {
      const tag = parseTagParam(raw.tag);
      const id = `${raw.kind}:${tag}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const name = raw.name.trim().slice(0, NAME_MAX).trim() || `#${tag}`;
      items.push({ kind: raw.kind, tag, name });
    }
    const imported = await store.importMany(userIdOf(req), items);
    res.setHeader('Cache-Control', 'no-store');
    sendData(res, { data: { imported }, source: 'fresh', fetchedAt: Date.now() });
  });

  router.put('/:kind/:tag', jsonBody('1kb'), async (req, res) => {
    const kind = parseKind(req.params.kind);
    const tag = parseTagParam(req.params.tag);
    const body = PutBodySchema.safeParse(req.body);
    if (!body.success) throw new AppError('INVALID_PARAM', 'Cuerpo inválido. Envía { "name": "1 a 64 caracteres" }.');
    await store.add(userIdOf(req), { kind, tag, name: body.data.name });
    res.status(204).end();
  });

  router.delete('/:kind/:tag', async (req, res) => {
    const kind = parseKind(req.params.kind);
    const tag = parseTagParam(req.params.tag);
    await store.remove(userIdOf(req), kind, tag);
    res.status(204).end();
  });

  return router;
}
