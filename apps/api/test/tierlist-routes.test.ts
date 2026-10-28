import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { Cache } from '../src/cache/cache';
import { createMemoryCache } from '../src/cache/memory';
import type { CommunityDeps, TierStore } from '../src/community/router';
import { createSessionStore, type SessionStore, type SessionUser } from '../src/community/sessions';
import { loadConfig } from '../src/config';
import { seasons, tierVotes, users } from '../src/db/schema';
import { createLogger } from '../src/logger';
import { withTestDb } from './db-helpers';

const SITE = 'http://localhost:3200';
const VALID_IDS = new Set(Array.from({ length: 30 }, (_, i) => 16_000_000 + i));
const B = (i: number) => 16_000_000 + i;

const USERS: Record<string, SessionUser> = {
  'tok-ana': { id: 1, discordId: '42', username: 'Ana', avatarUrl: null, playerTag: null },
  'tok-bob': { id: 2, discordId: '43', username: 'Bob', avatarUrl: null, playerTag: null },
  'tok-admin': { id: 3, discordId: '99', username: 'Admin', avatarUrl: null, playerTag: null },
};

type SeasonRow = { id: number; name: string; startedAt: Date; endedAt: Date | null };
type VoteRow = { seasonId: number; userId: number; brawlerId: number; tier: number };

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const toSeason = (s: SeasonRow) => ({ id: s.id, name: s.name, startedAt: iso(s.startedAt)!, endedAt: iso(s.endedAt) });

/** Store en memoria con la misma semántica que el de Drizzle: cada escritura es atómica (sin await en medio). */
function memoryTierStore(state: { seasons: SeasonRow[]; votes: VoteRow[] }, calls: { seasonVotes: number }): TierStore {
  const active = () => state.seasons.find((s) => s.endedAt === null) ?? null;
  return {
    async listSeasons() {
      return [...state.seasons].sort((a, b) => b.id - a.id).map(toSeason);
    },
    async getSeason(id) {
      const s = state.seasons.find((x) => x.id === id);
      return s ? toSeason(s) : null;
    },
    async activeSeason() {
      const s = active();
      return s ? toSeason(s) : null;
    },
    async openSeason(name, now) {
      const prev = active();
      if (prev) prev.endedAt = now;
      const row: SeasonRow = { id: state.seasons.length + 1, name, startedAt: now, endedAt: null };
      state.seasons.push(row);
      return { season: toSeason(row), closedId: prev?.id ?? null };
    },
    async seasonVotes(seasonId) {
      calls.seasonVotes++;
      return state.votes.filter((v) => v.seasonId === seasonId).map(({ userId, brawlerId, tier }) => ({ userId, brawlerId, tier }));
    },
    async userVotes(seasonId, userId) {
      return state.votes
        .filter((v) => v.seasonId === seasonId && v.userId === userId)
        .sort((a, b) => a.brawlerId - b.brawlerId)
        .map(({ brawlerId, tier }) => ({ brawlerId, tier }));
    },
    async replaceVotes(userId, votes) {
      const s = active();
      if (!s) return null;
      state.votes = state.votes.filter((v) => !(v.seasonId === s.id && v.userId === userId));
      state.votes.push(...votes.map((v) => ({ seasonId: s.id, userId, ...v })));
      return s.id;
    },
  };
}

/** Caché que registra los TTL y puede fallar a pedido. */
function spyCache(opts: { broken?: boolean } = {}) {
  const inner = createMemoryCache();
  const sets: { key: string; ttl: number }[] = [];
  const dels: string[] = [];
  const cache: Cache = {
    kind: 'memory',
    async get(key) {
      if (opts.broken) throw new Error('ECONNREFUSED');
      return inner.get(key);
    },
    async set(key, value, ttl) {
      if (opts.broken) throw new Error('ECONNREFUSED');
      sets.push({ key, ttl });
      return inner.set(key, value, ttl);
    },
    async del(key) {
      dels.push(key);
      if (opts.broken) throw new Error('ECONNREFUSED');
      return inner.del(key);
    },
  };
  return { cache, sets, dels };
}

function fakeApp(opts: { seasons?: SeasonRow[]; brokenCache?: boolean } = {}) {
  const state = { seasons: opts.seasons ?? [], votes: [] as VoteRow[] };
  const calls = { seasonVotes: 0 };
  const store: SessionStore = {
    create: async () => 'x',
    resolve: async (t) => (USERS[t] ? { ...USERS[t] } : null),
    destroy: async () => {},
  };
  const spy = spyCache({ broken: opts.brokenCache });
  const community: CommunityDeps = {
    db: {} as CommunityDeps['db'],
    sessions: store,
    config: loadConfig({ SUPERCELL_MOCK: '1', ADMIN_DISCORD_IDS: '99' }),
    brawlerIds: async () => new Set(VALID_IDS),
    cache: spy.cache,
    tiers: memoryTierStore(state, calls),
  };
  const app = createApp({ logger: createLogger('silent'), health: () => ({}) as never, community });
  return { app, state, calls, spy };
}

const closed = (id: number, name = `T${id}`): SeasonRow => ({
  id,
  name,
  startedAt: new Date(`2026-0${id}-01T00:00:00Z`),
  endedAt: new Date(`2026-0${id + 1}-01T00:00:00Z`),
});
const open = (id: number, name = `T${id}`): SeasonRow => ({
  id,
  name,
  startedAt: new Date(`2026-0${id}-01T00:00:00Z`),
  endedAt: null,
});

type App = ReturnType<typeof fakeApp>['app'];
const votes = (ids: number[], tier = 3) => ({ votes: ids.map((i) => ({ brawlerId: B(i), tier })) });
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const putMe = (app: App, body: unknown, token = 'tok-ana') =>
  request(app)
    .put('/api/v1/tierlist/me')
    .set('Origin', SITE)
    .set('Cookie', `bw_session=${token}`)
    .send(body as object);
const getMe = (app: App, token = 'tok-ana') => request(app).get('/api/v1/tierlist/me').set('Cookie', `bw_session=${token}`);
const postSeason = (app: App, body: unknown, token: string | null = 'tok-admin') => {
  const r = request(app).post('/api/v1/seasons').set('Origin', SITE);
  if (token) r.set('Cookie', `bw_session=${token}`);
  return r.send(body as object);
};

describe('GET /seasons', () => {
  it('público, la más nueva primero', async () => {
    const { app } = fakeApp({ seasons: [closed(1), closed(2), open(3)] });
    const res = await request(app).get('/api/v1/seasons');
    expect(res.status).toBe(200);
    expect(res.body.data.seasons.map((s: { id: number }) => s.id)).toEqual([3, 2, 1]);
    expect(res.body.data.seasons[0]).toEqual({ id: 3, name: 'T3', startedAt: '2026-03-01T00:00:00.000Z', endedAt: null });
  });

  it('sin temporadas → lista vacía', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/seasons');
    expect(res.status).toBe(200);
    expect(res.body.data.seasons).toEqual([]);
  });
});

describe('POST /seasons', () => {
  it('no admin o sin sesión → 404 (no revela la ruta); sin Origin → 403', async () => {
    const { app, state } = fakeApp();
    const user = await postSeason(app, { name: 'T1' }, 'tok-ana');
    expect(user.status).toBe(404);
    expect(user.body.error.code).toBe('NOT_FOUND');
    expect((await postSeason(app, { name: 'T1' }, null)).status).toBe(404);
    const csrf = await request(app).post('/api/v1/seasons').set('Cookie', 'bw_session=tok-admin').send({ name: 'T1' });
    expect(csrf.status).toBe(403);
    expect(state.seasons).toHaveLength(0);
  });

  it('admin crea la temporada y cierra la anterior: solo una activa', async () => {
    const { app, state } = fakeApp();
    const first = await postSeason(app, { name: '  Temporada 1  ' });
    expect(first.status).toBe(201);
    expect(first.body.data.season).toMatchObject({ id: 1, name: 'Temporada 1', endedAt: null });
    expect(typeof first.body.data.season.startedAt).toBe('string');
    const second = await postSeason(app, { name: 'Temporada 2' });
    expect(second.status).toBe(201);
    expect(second.body.data.season).toMatchObject({ id: 2, name: 'Temporada 2', endedAt: null });
    expect(state.seasons.filter((s) => s.endedAt === null).map((s) => s.id)).toEqual([2]);
    expect(state.seasons[0]?.endedAt).toBeInstanceOf(Date);
  });

  it('nombre inválido → 400 INVALID_PARAM y no crea nada', async () => {
    const { app, state } = fakeApp();
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(65) }, { name: 3 }, { name: 'a', x: 1 }]) {
      const res = await postSeason(app, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    expect(state.seasons).toHaveLength(0);
    expect((await postSeason(app, { name: 'x'.repeat(64) })).status).toBe(201);
  });

  it('abrir temporada invalida la caché de la que se cierra', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    const before = await request(app).get('/api/v1/tierlist?season=1');
    expect(before.body.data.season.endedAt).toBeNull();
    await postSeason(app, { name: 'T2' }).expect(201);
    const after = await request(app).get('/api/v1/tierlist?season=1');
    expect(after.body.data.season.endedAt).not.toBeNull();
    const active = await request(app).get('/api/v1/tierlist');
    expect(active.body.data.season.id).toBe(2);
  });
});

describe('GET /tierlist', () => {
  it('sin temporadas → 404 NOT_FOUND', async () => {
    const { app } = fakeApp();
    const res = await request(app).get('/api/v1/tierlist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('sin temporada activa y sin parámetro → 404; con ?season=<cerrada> funciona', async () => {
    const { app, state } = fakeApp({ seasons: [closed(1)] });
    state.votes.push(...range(0, 10).map((i) => ({ seasonId: 1, userId: 7, brawlerId: B(i), tier: 4 })));
    expect((await request(app).get('/api/v1/tierlist')).status).toBe(404);
    const res = await request(app).get('/api/v1/tierlist?season=1');
    expect(res.status).toBe(200);
    expect(res.body.data.season).toMatchObject({ id: 1, name: 'T1' });
    expect(res.body.data.season.endedAt).not.toBeNull();
    expect(res.body.data.voters).toBe(1);
    expect(res.body.data.rows).toHaveLength(10);
    expect(res.body.data.rows[0]).toEqual({ brawlerId: B(0), tier: null, average: 4, votes: 1 });
  });

  it('?season inválida → 400 INVALID_PARAM; inexistente → 404', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    for (const q of ['abc', '0', '-1', '1.5', '1e3', '', '99999999999', 'season=1']) {
      const res = await request(app).get(`/api/v1/tierlist?season=${q}`);
      expect(res.status, q).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    expect((await request(app).get('/api/v1/tierlist?season=1&season=1')).status).toBe(400);
    const missing = await request(app).get('/api/v1/tierlist?season=9');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('cachea: activa 5 min, cerrada 24 h; el segundo GET sale de la caché', async () => {
    const { app, calls, spy } = fakeApp({ seasons: [closed(1), open(2)] });
    const a = await request(app).get('/api/v1/tierlist');
    expect(a.headers['x-cache-status']).toBe('MISS');
    const b = await request(app).get('/api/v1/tierlist');
    expect(b.headers['x-cache-status']).toBe('HIT');
    expect(b.body.data).toEqual(a.body.data);
    expect(calls.seasonVotes).toBe(1);
    await request(app).get('/api/v1/tierlist?season=1');
    expect(spy.sets).toEqual([
      { key: 'tierlist:2', ttl: 300 },
      { key: 'tierlist:1', ttl: 86_400 },
    ]);
  });

  it('si la caché falla, responde igual (fail-open)', async () => {
    const { app } = fakeApp({ seasons: [open(1)], brokenCache: true });
    const res = await request(app).get('/api/v1/tierlist');
    expect(res.status).toBe(200);
    expect((await putMe(app, votes(range(0, 10)))).status).toBe(204);
  });
});

describe('PUT /tierlist/me', () => {
  it('sin temporadas → 409 NO_ACTIVE_SEASON', async () => {
    const { app, state } = fakeApp();
    const res = await putMe(app, votes(range(0, 10)));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_SEASON');
    expect(state.votes).toHaveLength(0);
    const closedOnly = fakeApp({ seasons: [closed(1)] });
    expect((await putMe(closedOnly.app, votes([1]))).status).toBe(409);
  });

  it('sin sesión → 401; sin Origin → 403', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    const anon = await request(app).put('/api/v1/tierlist/me').set('Origin', SITE).send(votes([1]));
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('UNAUTHENTICATED');
    const csrf = await request(app).put('/api/v1/tierlist/me').set('Cookie', 'bw_session=tok-ana').send(votes([1]));
    expect(csrf.status).toBe(403);
  });

  it('guarda → 204 sin cuerpo; reemplaza (12 y luego 10 deja 10 filas)', async () => {
    const { app, state } = fakeApp({ seasons: [open(1)] });
    const a = await putMe(app, votes(range(0, 12), 5));
    expect(a.status).toBe(204);
    expect(a.text).toBe('');
    expect(state.votes).toHaveLength(12);
    expect((await putMe(app, votes(range(10, 10), 2))).status).toBe(204);
    expect(state.votes).toHaveLength(10);
    expect(state.votes.every((v) => v.tier === 2 && v.userId === 1 && v.seasonId === 1)).toBe(true);
    expect(state.votes.map((v) => v.brawlerId).sort()).toEqual(range(10, 10).map(B));
  });

  it('lista vacía borra los votos del usuario; los de otros no se tocan', async () => {
    const { app, state } = fakeApp({ seasons: [open(1)] });
    await putMe(app, votes(range(0, 10))).expect(204);
    await putMe(app, votes(range(0, 10)), 'tok-bob').expect(204);
    await putMe(app, { votes: [] }).expect(204);
    expect(state.votes).toHaveLength(10);
    expect(state.votes.every((v) => v.userId === 2)).toBe(true);
  });

  it('brawlerId fuera de brawlerIds() → 400 INVALID_PARAM y no cambia nada', async () => {
    const { app, state } = fakeApp({ seasons: [open(1)] });
    await putMe(app, votes(range(0, 12))).expect(204);
    const before = structuredClone(state.votes);
    const res = await putMe(app, { votes: [{ brawlerId: B(0), tier: 5 }, { brawlerId: 99_999_999, tier: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAM');
    expect(state.votes).toEqual(before);
  });

  it('brawlerId repetido, tier fuera de 1..5, más de 200 o cuerpo raro → 400 y no cambia nada', async () => {
    const { app, state } = fakeApp({ seasons: [open(1)] });
    await putMe(app, votes(range(0, 12))).expect(204);
    const before = structuredClone(state.votes);
    const bad = [
      { votes: [{ brawlerId: B(0), tier: 5 }, { brawlerId: B(0), tier: 4 }] },
      { votes: [{ brawlerId: B(0), tier: 6 }] },
      { votes: [{ brawlerId: B(0), tier: 0 }] },
      { votes: [{ brawlerId: B(0), tier: 2.5 }] },
      { votes: [{ brawlerId: -1, tier: 2 }] },
      { votes: Array.from({ length: 201 }, (_, i) => ({ brawlerId: i + 1, tier: 1 })) },
      {},
      { votes: 'x' },
      [],
    ];
    for (const body of bad) {
      const res = await putMe(app, body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    }
    expect(state.votes).toEqual(before);
  });

  it('cuerpo demasiado grande → 400 INVALID_PARAM', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    const res = await putMe(app, { votes: [], pad: 'x'.repeat(40_000) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAM');
  });

  it('dos PUT concurrentes del mismo usuario → queda uno de los dos completo', async () => {
    const { app, state } = fakeApp({ seasons: [open(1)] });
    const setA = votes(range(0, 12), 5);
    const setB = votes(range(15, 10), 1);
    const [ra, rb] = await Promise.all([putMe(app, setA), putMe(app, setB)]);
    expect([ra.status, rb.status]).toEqual([204, 204]);
    const saved = state.votes
      .map((v) => ({ brawlerId: v.brawlerId, tier: v.tier }))
      .sort((a, b) => a.brawlerId - b.brawlerId);
    expect([setA.votes, setB.votes]).toContainEqual(saved);
  });

  it('votar invalida la caché: GET /tierlist refleja el voto al instante', async () => {
    const { app, spy } = fakeApp({ seasons: [open(1)] });
    const empty = await request(app).get('/api/v1/tierlist');
    expect(empty.body.data).toMatchObject({ voters: 0, rows: [] });
    expect((await request(app).get('/api/v1/tierlist')).headers['x-cache-status']).toBe('HIT');
    await putMe(app, votes(range(0, 10), 4)).expect(204);
    expect(spy.dels).toContain('tierlist:1');
    const after = await request(app).get('/api/v1/tierlist');
    expect(after.headers['x-cache-status']).toBe('MISS');
    expect(after.body.data.voters).toBe(1);
    expect(after.body.data.rows).toHaveLength(10);
  });

  it('el agregado por la ruta solo cuenta a usuarios con ≥ 10 brawlers ubicados', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    const tokens = ['tok-ana', 'tok-bob', 'tok-admin'];
    for (const t of tokens) await putMe(app, votes(range(0, 10), 5), t).expect(204);
    // Ana reemplaza su lista por una de 9 brawlers: deja de contar; quedan 2 votantes (< 5 votos → sin tier).
    await putMe(app, votes(range(0, 9), 1)).expect(204);
    const res = await request(app).get('/api/v1/tierlist');
    expect(res.body.data.voters).toBe(2);
    expect(res.body.data.rows[0]).toEqual({ brawlerId: B(0), tier: null, average: 5, votes: 2 });
  });

  it('el 11.º PUT en un minuto → 429 RATE_LIMITED; otro usuario no se ve afectado', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    for (let i = 0; i < 10; i++) expect((await putMe(app, votes([i]))).status).toBe(204);
    const blocked = await putMe(app, votes([1]));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error.requestId).toBe(blocked.headers['x-request-id']);
    expect((await putMe(app, votes([1]), 'tok-bob')).status).toBe(204);
    // El contador es por app: otra instancia arranca de cero.
    const other = fakeApp({ seasons: [open(1)] });
    expect((await putMe(other.app, votes([1]))).status).toBe(204);
  });
});

describe('GET /tierlist/me', () => {
  it('votos propios de la temporada activa, ordenados, no cacheable', async () => {
    const { app } = fakeApp({ seasons: [closed(1), open(2)] });
    await putMe(app, { votes: [{ brawlerId: B(3), tier: 2 }, { brawlerId: B(1), tier: 5 }] }).expect(204);
    await putMe(app, votes([7]), 'tok-bob').expect(204);
    const res = await getMe(app);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({
      season: { id: 2, name: 'T2', startedAt: '2026-02-01T00:00:00.000Z', endedAt: null },
      votes: [
        { brawlerId: B(1), tier: 5 },
        { brawlerId: B(3), tier: 2 },
      ],
    });
  });

  it('sin votos → lista vacía; sin temporada activa → 409; sin sesión → 401', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    expect((await getMe(app)).body.data.votes).toEqual([]);
    const none = fakeApp({ seasons: [closed(1)] });
    const res = await getMe(none.app);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_SEASON');
    expect((await request(app).get('/api/v1/tierlist/me')).status).toBe(401);
  });

  it('al abrir temporada nueva los votos de la anterior quedan en ella', async () => {
    const { app } = fakeApp({ seasons: [open(1)] });
    await putMe(app, votes(range(0, 10), 4)).expect(204);
    await postSeason(app, { name: 'T2' }).expect(201);
    expect((await getMe(app)).body.data).toMatchObject({ season: { id: 2 }, votes: [] });
    const old = await request(app).get('/api/v1/tierlist?season=1');
    expect(old.body.data.voters).toBe(1);
  });
});

const testDb = withTestDb();

describe.skipIf(!testDb)('con MySQL', () => {
  function dbApp() {
    if (!testDb) throw new Error('sin DB');
    const db = testDb.db;
    const config = loadConfig({ SUPERCELL_MOCK: '1', ADMIN_DISCORD_IDS: 'adm' });
    const store = createSessionStore(db);
    const app = createApp({
      logger: createLogger('silent'),
      health: () => ({}) as never,
      community: { db, sessions: store, config, brawlerIds: async () => new Set(VALID_IDS), cache: createMemoryCache() },
    });
    return { app, db, store, origin: config.publicSiteUrl };
  }

  async function seedUser(db: NonNullable<typeof testDb>['db'], discordId: string) {
    const [r] = await db.insert(users).values({ discordId, username: `u${discordId}` });
    return r.insertId;
  }

  it('temporadas: crear, cerrar la anterior, listar; votos: reemplazo, inválidos, concurrencia y agregado', async () => {
    if (!testDb) return;
    await testDb.reset();
    const { app, db, store, origin } = dbApp();
    const admin = `bw_session=${await store.create(await seedUser(db, 'adm'))}`;
    const userId = await seedUser(db, 'd1');
    const c = `bw_session=${await store.create(userId)}`;
    const put = (body: unknown, cookie = c) =>
      request(app).put('/api/v1/tierlist/me').set('Origin', origin).set('Cookie', cookie).send(body as object);

    expect((await request(app).get('/api/v1/tierlist')).status).toBe(404);
    expect((await put(votes([1]))).status).toBe(409);

    await request(app).post('/api/v1/seasons').set('Origin', origin).set('Cookie', admin).send({ name: 'T1' }).expect(201);
    const s2 = await request(app).post('/api/v1/seasons').set('Origin', origin).set('Cookie', admin).send({ name: 'T2' });
    expect(s2.status).toBe(201);
    expect(await db.select().from(seasons).where(isNull(seasons.endedAt))).toHaveLength(1);
    const list = await request(app).get('/api/v1/seasons');
    expect(list.body.data.seasons.map((s: { name: string }) => s.name)).toEqual(['T2', 'T1']);
    const activeId: number = s2.body.data.season.id;

    await put(votes(range(0, 12), 5)).expect(204);
    await put(votes(range(10, 10), 2)).expect(204);
    const mine = () => db.select().from(tierVotes).where(and(eq(tierVotes.userId, userId), eq(tierVotes.seasonId, activeId)));
    expect(await mine()).toHaveLength(10);

    expect((await put({ votes: [{ brawlerId: B(0), tier: 5 }, { brawlerId: 1, tier: 5 }] })).status).toBe(400);
    expect(await mine()).toHaveLength(10);

    const setA = votes(range(0, 12), 5);
    const setB = votes(range(15, 10), 1);
    const [ra, rb] = await Promise.all([put(setA), put(setB)]);
    expect([ra.status, rb.status]).toEqual([204, 204]);
    const saved = (await mine()).map((v) => ({ brawlerId: v.brawlerId, tier: v.tier })).sort((a, b) => a.brawlerId - b.brawlerId);
    expect([setA.votes, setB.votes]).toContainEqual(saved);

    const tl = await request(app).get('/api/v1/tierlist');
    expect(tl.status).toBe(200);
    expect(tl.body.data.season.id).toBe(activeId);
    expect(tl.body.data.voters).toBe(1);
    expect(tl.body.data.rows).toHaveLength(saved.length);

    const me = await request(app).get('/api/v1/tierlist/me').set('Cookie', c);
    expect(me.body.data.votes).toEqual(saved);
  });
});
