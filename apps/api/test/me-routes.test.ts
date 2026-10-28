import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMemoryCache } from '../src/cache/memory';
import type { CommunityDeps } from '../src/community/router';
import { createSessionStore, hashToken, type SessionStore, type SessionUser } from '../src/community/sessions';
import { loadConfig } from '../src/config';
import { favorites, seasons, sessions, tierVotes, users } from '../src/db/schema';
import { createLogger } from '../src/logger';
import { withTestDb } from './db-helpers';

const SITE = 'http://localhost:3200';
const TOKEN = 'tok-ana';

function fakeApp(opts: { withCommunity?: boolean; admin?: boolean } = {}) {
  const state = {
    user: { id: 1, discordId: '42', username: 'Ana', avatarUrl: null, playerTag: null } as SessionUser,
    sessions: new Set<string>([TOKEN]),
    deleted: [] as number[],
  };
  const store: SessionStore = {
    create: async () => 'x',
    resolve: async (t) => (state.sessions.has(t) ? { ...state.user } : null),
    destroy: async () => {},
  };
  const config = loadConfig({
    SUPERCELL_MOCK: '1',
    ...(opts.admin ? { ADMIN_DISCORD_IDS: '42' } : {}),
  });
  const community: CommunityDeps = {
    db: {} as CommunityDeps['db'],
    sessions: store,
    config,
    brawlerIds: async () => new Set<number>(),
    cache: createMemoryCache(),
    accounts: {
      async setPlayerTag(userId, tag) {
        if (userId === state.user.id) state.user.playerTag = tag;
      },
      async deleteUser(userId) {
        state.deleted.push(userId);
        state.sessions.clear();
      },
    },
  };
  const app = createApp({
    logger: createLogger('silent'),
    health: () => ({}) as never,
    ...(opts.withCommunity === false ? {} : { community }),
  });
  return { app, state };
}

const cookie = `bw_session=${TOKEN}`;

describe('GET /me', () => {
  it('sin cookie → 200 { user: null }, nunca 401', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ user: null });
  });

  it('con cookie inválida → { user: null }', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/me').set('Cookie', 'bw_session=nope');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ user: null });
  });

  it('con sesión → usuario con isAdmin, sin discordId, y no cacheable', async () => {
    const { app } = fakeApp({ admin: true });
    const res = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      user: { id: 1, username: 'Ana', avatarUrl: null, playerTag: null, isAdmin: true },
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('isAdmin=false si no está en ADMIN_DISCORD_IDS', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(res.body.data.user.isAdmin).toBe(false);
  });
});

describe('PATCH /me', () => {
  const patch = (app: ReturnType<typeof fakeApp>['app'], body: unknown) =>
    request(app)
      .patch('/api/v1/me')
      .set('Origin', SITE)
      .set('Cookie', cookie)
      .send(body as object);

  it('"#2pp" se guarda normalizado como 2PP y devuelve el usuario', async () => {
    const { app, state } = fakeApp();
    const res = await patch(app, { playerTag: '#2pp' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: 1, username: 'Ana', avatarUrl: null, playerTag: '2PP', isAdmin: false });
    expect(state.user.playerTag).toBe('2PP');
  });

  it('"XYZ" → 400 INVALID_TAG y no guarda', async () => {
    const { app, state } = fakeApp();
    const res = await patch(app, { playerTag: 'XYZ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TAG');
    expect(state.user.playerTag).toBeNull();
  });

  it('null quita el tag', async () => {
    const { app, state } = fakeApp();
    state.user.playerTag = '2PP';
    const res = await patch(app, { playerTag: null });
    expect(res.status).toBe(200);
    expect(res.body.data.user.playerTag).toBeNull();
    expect(state.user.playerTag).toBeNull();
  });

  it('cuerpo inválido → 400 INVALID_PARAM', async () => {
    const { app } = fakeApp();
    for (const body of [{}, { playerTag: 5 }, { playerTag: '2PP', extra: 1 }, [], 'x']) {
      const res = await patch(app, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    const bad = await request(app)
      .patch('/api/v1/me')
      .set('Origin', SITE)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{nope');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_PARAM');
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app } = fakeApp();
    const anon = await request(app).patch('/api/v1/me').set('Origin', SITE).send({ playerTag: null });
    expect(anon.status).toBe(401);
    const csrf = await request(app).patch('/api/v1/me').set('Cookie', cookie).send({ playerTag: null });
    expect(csrf.status).toBe(403);
  });
});

describe('DELETE /me', () => {
  it('→ 204, borra la cuenta y expira la cookie', async () => {
    const { app, state } = fakeApp();
    const res = await request(app).delete('/api/v1/me').set('Origin', SITE).set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(state.deleted).toEqual([1]);
    const sc = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith('bw_session='));
    expect(sc).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Lax/);
    expect(sc).toMatch(/Path=\//);
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app, state } = fakeApp();
    expect((await request(app).delete('/api/v1/me').set('Origin', SITE)).status).toBe(401);
    expect((await request(app).delete('/api/v1/me').set('Cookie', cookie)).status).toBe(403);
    expect(state.deleted).toEqual([]);
  });
});

describe('modo v1 (sin Comunidad)', () => {
  it('/api/v1/me → 404', async () => {
    const { app } = fakeApp({ withCommunity: false });
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
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

  it('PATCH persiste el tag normalizado y null lo quita', async () => {
    if (!testDb) return;
    await testDb.reset();
    const { app, db, store, origin } = dbApp();
    const id = await seedUser(db, 'd1');
    const token = await store.create(id);
    const c = `bw_session=${token}`;
    const res = await request(app)
      .patch('/api/v1/me')
      .set('Origin', origin)
      .set('Cookie', c)
      .send({ playerTag: '#2pp' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.playerTag).toBe('2PP');
    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row?.playerTag).toBe('2PP');
    const me = await request(app).get('/api/v1/me').set('Cookie', c);
    expect(me.body.data.user.playerTag).toBe('2PP');
    await request(app).patch('/api/v1/me').set('Origin', origin).set('Cookie', c).send({ playerTag: null }).expect(200);
    const [after] = await db.select().from(users).where(eq(users.id, id));
    expect(after?.playerTag).toBeNull();
  });

  it('DELETE borra usuario, sesiones, favoritos y votos (y no toca a otros)', async () => {
    if (!testDb) return;
    await testDb.reset();
    const { app, db, store, origin } = dbApp();
    const id = await seedUser(db, 'd1');
    const other = await seedUser(db, 'd2');
    const token = await store.create(id);
    await store.create(id);
    await store.create(other);
    const [season] = await db.insert(seasons).values({ name: 'T1', startedAt: new Date() });
    for (const uid of [id, other]) {
      await db.insert(favorites).values({ userId: uid, kind: 'player', tag: '2PP', name: 'X' });
      await db.insert(tierVotes).values({ seasonId: season.insertId, userId: uid, brawlerId: 16000000, tier: 3 });
    }
    const res = await request(app).delete('/api/v1/me').set('Origin', origin).set('Cookie', `bw_session=${token}`);
    expect(res.status).toBe(204);
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(0);
    expect(await db.select().from(favorites).where(eq(favorites.userId, id))).toHaveLength(0);
    expect(await db.select().from(tierVotes).where(eq(tierVotes.userId, id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.id, hashToken(token)))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, other))).toHaveLength(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, other))).toHaveLength(1);
    expect(await db.select().from(favorites).where(eq(favorites.userId, other))).toHaveLength(1);
    expect(await db.select().from(tierVotes).where(eq(tierVotes.userId, other))).toHaveLength(1);
  });
});
