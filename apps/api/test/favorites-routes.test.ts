import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMemoryCache } from '../src/cache/memory';
import type { CommunityDeps, FavoriteStore } from '../src/community/router';
import { createSessionStore, type SessionStore, type SessionUser } from '../src/community/sessions';
import { loadConfig } from '../src/config';
import { favorites, users } from '../src/db/schema';
import { createLogger } from '../src/logger';
import { withTestDb } from './db-helpers';

const SITE = 'http://localhost:3200';
const TOKEN = 'tok-ana';
const cookie = `bw_session=${TOKEN}`;

type Row = { userId: number; kind: 'player' | 'club'; tag: string; name: string; createdAt: Date };

/** Store en memoria con la misma semántica que el de Drizzle (INSERT IGNORE, createdAt desc). */
function memoryStore(rows: Row[]): FavoriteStore {
  let clock = 1_700_000_000_000;
  const has = (u: number, k: string, t: string) => rows.some((r) => r.userId === u && r.kind === k && r.tag === t);
  return {
    async list(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => ({ kind: r.kind, tag: r.tag, name: r.name, createdAt: r.createdAt.toISOString() }));
    },
    async add(userId, item) {
      if (has(userId, item.kind, item.tag)) return;
      rows.push({ userId, ...item, createdAt: new Date((clock += 1000)) });
    },
    async get(userId, kind, tag) {
      const r = rows.find((x) => x.userId === userId && x.kind === kind && x.tag === tag);
      return r ? { kind: r.kind, tag: r.tag, name: r.name, createdAt: r.createdAt.toISOString() } : null;
    },
    async remove(userId, kind, tag) {
      const i = rows.findIndex((r) => r.userId === userId && r.kind === kind && r.tag === tag);
      if (i >= 0) rows.splice(i, 1);
    },
    async importMany(userId, items) {
      let n = 0;
      for (const item of items) {
        if (has(userId, item.kind, item.tag)) continue;
        rows.push({ userId, ...item, createdAt: new Date((clock += 1000)) });
        n++;
      }
      return n;
    },
  };
}

function fakeApp() {
  const rows: Row[] = [];
  const user: SessionUser = { id: 1, discordId: '42', username: 'Ana', avatarUrl: null, playerTag: null };
  const store: SessionStore = {
    create: async () => 'x',
    resolve: async (t) => (t === TOKEN ? { ...user } : null),
    destroy: async () => {},
  };
  const community: CommunityDeps = {
    db: {} as CommunityDeps['db'],
    sessions: store,
    config: loadConfig({ SUPERCELL_MOCK: '1' }),
    brawlerIds: async () => new Set<number>(),
    cache: createMemoryCache(),
    favorites: memoryStore(rows),
  };
  const app = createApp({ logger: createLogger('silent'), health: () => ({}) as never, community });
  return { app, rows };
}

type App = ReturnType<typeof fakeApp>['app'];
const put = (app: App, path: string, body: unknown = { name: 'Ana' }) =>
  request(app)
    .put(`/api/v1/me/favorites/${path}`)
    .set('Origin', SITE)
    .set('Cookie', cookie)
    .send(body as object);
const del = (app: App, path: string) =>
  request(app).delete(`/api/v1/me/favorites/${path}`).set('Origin', SITE).set('Cookie', cookie);
const imp = (app: App, body: unknown) =>
  request(app)
    .post('/api/v1/me/favorites/import')
    .set('Origin', SITE)
    .set('Cookie', cookie)
    .send(body as object);
const list = (app: App) => request(app).get('/api/v1/me/favorites').set('Cookie', cookie);

describe('GET /me/favorites', () => {
  it('lista ordenada por createdAt desc, no cacheable', async () => {
    const { app } = fakeApp();
    await put(app, 'player/2PP', { name: 'Uno' });
    await put(app, 'club/8L0', { name: 'Dos' });
    await put(app, 'player/PPP', { name: 'Tres' });
    const res = await list(app);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.favorites.map((f: { name: string }) => f.name)).toEqual(['Tres', 'Dos', 'Uno']);
    expect(res.body.data.favorites[1]).toMatchObject({ kind: 'club', tag: '8L0', name: 'Dos' });
    expect(typeof res.body.data.favorites[0].createdAt).toBe('string');
    expect(res.body.meta).toBeDefined();
  });

  it('sin sesión → 401', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/me/favorites');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('no rompe GET /me', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('Ana');
  });
});

describe('PUT /me/favorites/:kind/:tag', () => {
  it('guarda normalizado y es idempotente: dos PUT → una fila, nombre original', async () => {
    const { app, rows } = fakeApp();
    const a = await put(app, 'player/%232pp', { name: 'Primero' });
    expect(a.status).toBe(200);
    expect(a.body.data.favorite).toMatchObject({ kind: 'player', tag: '2PP', name: 'Primero' });
    const b = await put(app, 'player/2PP', { name: 'Otro' });
    expect(b.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Primero');
    expect(b.body.data.favorite.name).toBe('Primero');
  });

  it('kind inválido → 400 INVALID_PARAM; tag inválido → 400 INVALID_TAG', async () => {
    const { app, rows } = fakeApp();
    const k = await put(app, 'brawler/2PP');
    expect(k.status).toBe(400);
    expect(k.body.error.code).toBe('INVALID_PARAM');
    const t = await put(app, 'player/XYZ');
    expect(t.status).toBe(400);
    expect(t.body.error.code).toBe('INVALID_TAG');
    expect(rows).toHaveLength(0);
  });

  it('cuerpo inválido (nombre vacío, largo, ausente o extra) → 400 INVALID_PARAM', async () => {
    const { app, rows } = fakeApp();
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(65) }, { name: 5 }, { name: 'a', x: 1 }]) {
      const res = await put(app, 'player/2PP', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    expect(rows).toHaveLength(0);
  });

  it('nombre de 64 caracteres vale', async () => {
    const { app } = fakeApp();
    expect((await put(app, 'player/2PP', { name: 'x'.repeat(64) })).status).toBe(200);
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app } = fakeApp();
    const anon = await request(app).put('/api/v1/me/favorites/player/2PP').set('Origin', SITE).send({ name: 'A' });
    expect(anon.status).toBe(401);
    const csrf = await request(app).put('/api/v1/me/favorites/player/2PP').set('Cookie', cookie).send({ name: 'A' });
    expect(csrf.status).toBe(403);
  });
});

describe('DELETE /me/favorites/:kind/:tag', () => {
  it('borra y es idempotente: inexistente → 204', async () => {
    const { app, rows } = fakeApp();
    await put(app, 'player/2PP');
    expect((await del(app, 'player/2PP')).status).toBe(204);
    expect(rows).toHaveLength(0);
    expect((await del(app, 'player/2PP')).status).toBe(204);
    expect((await del(app, 'club/8L0')).status).toBe(204);
  });

  it('kind inválido → 400 INVALID_PARAM; tag inválido → 400 INVALID_TAG', async () => {
    const { app } = fakeApp();
    expect((await del(app, 'brawler/2PP')).body.error.code).toBe('INVALID_PARAM');
    expect((await del(app, 'club/XYZ')).body.error.code).toBe('INVALID_TAG');
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app } = fakeApp();
    expect((await request(app).delete('/api/v1/me/favorites/player/2PP').set('Origin', SITE)).status).toBe(401);
    expect((await request(app).delete('/api/v1/me/favorites/player/2PP').set('Cookie', cookie)).status).toBe(403);
  });
});

describe('POST /me/favorites/import', () => {
  it('3 ítems con 1 ya existente → { imported: 2 } y no pisa el nombre', async () => {
    const { app, rows } = fakeApp();
    await put(app, 'player/2PP', { name: 'Original' });
    const res = await imp(app, {
      items: [
        { kind: 'player', tag: '#2pp', name: 'Pisado' },
        { kind: 'club', tag: '8L0', name: 'Club' },
        { kind: 'player', tag: 'PPP', name: 'Otro' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imported: 2 });
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.tag === '2PP')?.name).toBe('Original');
  });

  it('duplicados dentro del mismo envío cuentan una vez; el primero gana', async () => {
    const { app, rows } = fakeApp();
    const res = await imp(app, {
      items: [
        { kind: 'player', tag: '2PP', name: 'A' },
        { kind: 'player', tag: '#2pp', name: 'B' },
      ],
    });
    expect(res.body.data).toEqual({ imported: 1 });
    expect(rows.map((r) => r.name)).toEqual(['A']);
  });

  it('nombres largos se truncan a 64 y los vacíos usan #TAG', async () => {
    const { app, rows } = fakeApp();
    await imp(app, {
      items: [
        { kind: 'player', tag: '2PP', name: 'x'.repeat(200) },
        { kind: 'club', tag: '8L0', name: '  ' },
      ],
    });
    expect(rows.find((r) => r.tag === '2PP')?.name).toHaveLength(64);
    expect(rows.find((r) => r.tag === '8L0')?.name).toBe('#8L0');
  });

  it('lista vacía → { imported: 0 }; 100 ítems vale, 101 → 400', async () => {
    const { app } = fakeApp();
    expect((await imp(app, { items: [] })).body.data).toEqual({ imported: 0 });
    const letters = '0289PYLQGRJCUV';
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        kind: 'player',
        tag: `2P${letters[i % 10]}${letters[Math.floor(i / 10)]}`,
        name: `n${i}`,
      }));
    const ok = await imp(app, { items: mk(100) });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ imported: 100 });
    const many = await imp(app, { items: mk(101) });
    expect(many.status).toBe(400);
    expect(many.body.error.code).toBe('INVALID_PARAM');
  });

  it('un tag inválido rechaza todo el envío con 400 INVALID_TAG', async () => {
    const { app, rows } = fakeApp();
    const res = await imp(app, {
      items: [
        { kind: 'player', tag: '2PP', name: 'Bien' },
        { kind: 'player', tag: 'XYZ', name: 'Mal' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TAG');
    expect(rows).toHaveLength(0);
  });

  it('cuerpo inválido o demasiado grande → 400 INVALID_PARAM', async () => {
    const { app } = fakeApp();
    for (const body of [{}, { items: 'x' }, { items: [{ kind: 'brawler', tag: '2PP', name: 'a' }] }, []]) {
      const res = await imp(app, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    const big = await imp(app, { items: [{ kind: 'player', tag: '2PP', name: 'x'.repeat(40_000) }] });
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe('INVALID_PARAM');
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app } = fakeApp();
    expect((await request(app).post('/api/v1/me/favorites/import').set('Origin', SITE).send({ items: [] })).status).toBe(
      401,
    );
    expect((await request(app).post('/api/v1/me/favorites/import').set('Cookie', cookie).send({ items: [] })).status).toBe(
      403,
    );
  });
});

const testDb = withTestDb();

describe.skipIf(!testDb)('con MySQL', () => {
  function dbApp() {
    if (!testDb) throw new Error('sin DB');
    const db = testDb.db;
    const config = loadConfig({ SUPERCELL_MOCK: '1' });
    const store = createSessionStore(db);
    const app = createApp({
      logger: createLogger('silent'),
      health: () => ({}) as never,
      community: { db, sessions: store, config, brawlerIds: async () => new Set<number>(), cache: createMemoryCache() },
    });
    return { app, db, store, origin: config.publicSiteUrl };
  }

  async function seedUser(db: NonNullable<typeof testDb>['db'], discordId: string) {
    const [r] = await db.insert(users).values({ discordId, username: `u${discordId}` });
    return r.insertId;
  }

  it('PUT dos veces → una fila; DELETE inexistente → 204; aislado por usuario', async () => {
    if (!testDb) return;
    await testDb.reset();
    const { app, db, store, origin } = dbApp();
    const id = await seedUser(db, 'd1');
    const other = await seedUser(db, 'd2');
    const c = `bw_session=${await store.create(id)}`;
    const base = '/api/v1/me/favorites';
    await request(app).put(`${base}/player/2PP`).set('Origin', origin).set('Cookie', c).send({ name: 'Uno' }).expect(200);
    await request(app).put(`${base}/player/2PP`).set('Origin', origin).set('Cookie', c).send({ name: 'Dos' }).expect(200);
    await db.insert(favorites).values({ userId: other, kind: 'player', tag: '2PP', name: 'Ajeno' });
    const rows = await db.select().from(favorites).where(eq(favorites.userId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Uno');
    await request(app).delete(`${base}/club/8L0`).set('Origin', origin).set('Cookie', c).expect(204);
    await request(app).delete(`${base}/player/2PP`).set('Origin', origin).set('Cookie', c).expect(204);
    expect(await db.select().from(favorites).where(eq(favorites.userId, id))).toHaveLength(0);
    expect(await db.select().from(favorites).where(eq(favorites.userId, other))).toHaveLength(1);
  });

  it('import: solo cuenta los nuevos y no pisa nombres; la lista sale por createdAt desc', async () => {
    if (!testDb) return;
    await testDb.reset();
    const { app, db, store, origin } = dbApp();
    const id = await seedUser(db, 'd1');
    const c = `bw_session=${await store.create(id)}`;
    await db
      .insert(favorites)
      .values({ userId: id, kind: 'player', tag: '2PP', name: 'Original', createdAt: new Date('2026-01-01T00:00:00Z') });
    const res = await request(app)
      .post('/api/v1/me/favorites/import')
      .set('Origin', origin)
      .set('Cookie', c)
      .send({
        items: [
          { kind: 'player', tag: '2PP', name: 'Pisado' },
          { kind: 'club', tag: '8L0', name: 'Club' },
          { kind: 'player', tag: 'PPP', name: 'Otro' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imported: 2 });
    const [orig] = await db.select().from(favorites).where(eq(favorites.tag, '2PP'));
    expect(orig?.name).toBe('Original');
    const l = await request(app).get('/api/v1/me/favorites').set('Cookie', c);
    expect(l.status).toBe(200);
    const dates = l.body.data.favorites.map((f: { createdAt: string }) => f.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(l.body.data.favorites.at(-1).tag).toBe('2PP');
  });
});
