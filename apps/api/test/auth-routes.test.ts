import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMemoryCache } from '../src/cache/memory';
import { createDiscordClient, type DiscordProfile, upsertDiscordUser } from '../src/community/discord';
import type { CommunityDeps } from '../src/community/router';
import { createSessionStore, hashToken, type SessionStore, type SessionUser } from '../src/community/sessions';
import { effectiveAdminIds, loadConfig } from '../src/config';
import { sessions, users } from '../src/db/schema';
import { createLogger } from '../src/logger';
import { OAUTH_COOKIE, safeNext } from '../src/routes/auth';
import { withTestDb } from './db-helpers';

const SITE = 'http://localhost:3200';
const PROFILE = { id: '777', username: 'ana', global_name: 'Ana', avatar: 'abc' };

function fakeFetch(profile = PROFILE, okToken = true) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }), {
        status: okToken ? 200 : 400,
      });
    }
    return new Response(JSON.stringify(profile), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

interface Fakes {
  users: Map<string, { id: number; username: string }>;
  sessions: Map<string, number>;
}

function fakeDeps(env: Record<string, string> = {}, fetchImpl = fakeFetch().impl) {
  const f: Fakes = { users: new Map(), sessions: new Map() };
  let seq = 0;
  const store: SessionStore = {
    async create(userId) {
      const t = `tok${++seq}`;
      f.sessions.set(t, userId);
      return t;
    },
    async resolve(t) {
      const uid = f.sessions.get(t);
      if (uid === undefined) return null;
      const entry = [...f.users.entries()].find(([, v]) => v.id === uid);
      if (!entry) return null;
      const [discordId, u] = entry;
      return { id: uid, discordId, username: u.username, avatarUrl: null, playerTag: null } satisfies SessionUser;
    },
    async destroy(t) {
      f.sessions.delete(t);
    },
  };
  const config = loadConfig({ SUPERCELL_MOCK: '1', DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec', ...env });
  const community: CommunityDeps = {
    db: {} as CommunityDeps['db'],
    sessions: store,
    config,
    brawlerIds: async () => new Set<number>(),
    cache: createMemoryCache(),
    fetchImpl,
    upsertUser: async (p: DiscordProfile) => {
      const name = p.globalName ?? p.username;
      const ex = f.users.get(p.id);
      if (ex) {
        ex.username = name;
        return ex.id;
      }
      const id = f.users.size + 1;
      f.users.set(p.id, { id, username: name });
      return id;
    },
  };
  return { app: createApp({ logger: createLogger('silent'), health: () => ({}) as never, community }), f };
}

function setCookieHeader(res: request.Response, name: string): string | undefined {
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${name}=`));
}
function cookieValue(res: request.Response, name: string): string | undefined {
  const c = setCookieHeader(res, name);
  return c ? decodeURIComponent(c.split(';')[0].slice(name.length + 1)) : undefined;
}

type App = ReturnType<typeof fakeDeps>['app'];

async function startLogin(app: App, next = '/tierlist') {
  const res = await request(app).get(`/api/v1/auth/discord?next=${encodeURIComponent(next)}`);
  const oauth = cookieValue(res, OAUTH_COOKIE) ?? '';
  const parsed = JSON.parse(Buffer.from(oauth, 'base64url').toString()) as { state: string; next: string };
  return { res, oauth, state: parsed.state, next: parsed.next };
}

describe('safeNext', () => {
  it('rechaza externas y acepta rutas locales', () => {
    for (const v of ['//evil.com', 'https://x', '/\\evil', '', undefined, 42, ['/a']]) expect(safeNext(v)).toBe('/');
    expect(safeNext('/tierlist?x=1')).toBe('/tierlist?x=1');
  });
});

describe('createDiscordClient', () => {
  it('authorizeUrl con scope=identify y redirect', () => {
    const c = createDiscordClient({ clientId: 'cid', clientSecret: 's', redirectUri: `${SITE}/auth/discord/callback` });
    const u = new URL(c.authorizeUrl('st'));
    expect(u.origin + u.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'cid',
      response_type: 'code',
      scope: 'identify',
      redirect_uri: `${SITE}/auth/discord/callback`,
      state: 'st',
    });
  });

  it('exchange: POST token y GET @me', async () => {
    const { impl, calls } = fakeFetch();
    const c = createDiscordClient({ clientId: 'cid', clientSecret: 's', redirectUri: 'r', fetchImpl: impl });
    expect(await c.exchange('code1')).toEqual({ id: '777', username: 'ana', globalName: 'Ana', avatar: 'abc' });
    expect(calls[0].url).toBe('https://discord.com/api/oauth2/token');
    expect(calls[0].init?.method).toBe('POST');
    expect(String(calls[0].init?.body)).toContain('code=code1');
    expect(calls[1].url).toBe('https://discord.com/api/users/@me');
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('exchange falla si Discord rechaza el código', async () => {
    const c = createDiscordClient({
      clientId: 'c',
      clientSecret: 's',
      redirectUri: 'r',
      fetchImpl: fakeFetch(PROFILE, false).impl,
    });
    await expect(c.exchange('x')).rejects.toThrow();
  });
});

describe('rutas /auth', () => {
  it('/auth/discord → 302 a Discord con el state de la cookie', async () => {
    const { app } = fakeDeps();
    const { res, state, next } = await startLogin(app);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(loc.origin + loc.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(loc.searchParams.get('scope')).toBe('identify');
    expect(loc.searchParams.get('redirect_uri')).toBe(`${SITE}/auth/discord/callback`);
    expect(loc.searchParams.get('state')).toBe(state);
    expect(next).toBe('/tierlist');
    const sc = setCookieHeader(res, OAUTH_COOKIE) ?? '';
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Lax/);
    expect(sc).toMatch(/Max-Age=600/);
  });

  it('next inseguro se reemplaza por /', async () => {
    const { app } = fakeDeps();
    expect((await startLogin(app, '//evil.com')).next).toBe('/');
  });

  it('callback con state distinto → /?login=error sin sesión', async () => {
    const { app, f } = fakeDeps();
    const { oauth } = await startLogin(app, '/');
    const res = await request(app)
      .get('/api/v1/auth/discord/callback?code=c&state=otro')
      .set('Cookie', `${OAUTH_COOKIE}=${oauth}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?login=error');
    expect(setCookieHeader(res, 'bw_session')).toBeUndefined();
    expect(f.sessions.size).toBe(0);
  });

  it('callback sin cookie o con error de Discord → login=error (con & si next tiene query)', async () => {
    const { app, f } = fakeDeps({}, fakeFetch(PROFILE, false).impl);
    expect((await request(app).get('/api/v1/auth/discord/callback?code=c&state=s')).headers.location).toBe(
      '/?login=error',
    );
    const { oauth, state } = await startLogin(app, '/tierlist?x=1');
    const res = await request(app)
      .get(`/api/v1/auth/discord/callback?code=c&state=${state}`)
      .set('Cookie', `${OAUTH_COOKIE}=${oauth}`);
    expect(res.headers.location).toBe('/tierlist?x=1&login=error');
    expect(f.sessions.size).toBe(0);
  });

  it('callback válido crea usuario y sesión; segundo login actualiza sin duplicar', async () => {
    const profile = { ...PROFILE };
    const { app, f } = fakeDeps({}, fakeFetch(profile).impl);
    const { oauth, state } = await startLogin(app, '/cuenta');
    const res = await request(app)
      .get(`/api/v1/auth/discord/callback?code=c&state=${state}`)
      .set('Cookie', `${OAUTH_COOKIE}=${oauth}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/cuenta');
    expect(cookieValue(res, 'bw_session')).toBe('tok1');
    expect(setCookieHeader(res, 'bw_session')).toMatch(/HttpOnly/);
    expect(setCookieHeader(res, OAUTH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(f.users.get('777')).toEqual({ id: 1, username: 'Ana' });

    profile.global_name = 'Ana Nueva';
    const second = await startLogin(app, '/');
    await request(app)
      .get(`/api/v1/auth/discord/callback?code=c&state=${second.state}`)
      .set('Cookie', `${OAUTH_COOKIE}=${second.oauth}`);
    expect(f.users.size).toBe(1);
    expect(f.users.get('777')?.username).toBe('Ana Nueva');
  });

  it('AUTH_MOCK=1: /auth/discord crea sesión de MockUser', async () => {
    const { app, f } = fakeDeps({ AUTH_MOCK: '1' });
    const res = await request(app).get('/api/v1/auth/discord?next=/cuenta');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/cuenta');
    expect(cookieValue(res, 'bw_session')).toBeDefined();
    expect(f.users.get('mock-1')?.username).toBe('MockUser');
  });

  it('AUTH_MOCK_ADMIN=1 hace admin a mock-1 (y solo con AUTH_MOCK)', () => {
    const c = (e: Record<string, string>) => loadConfig({ SUPERCELL_MOCK: '1', ADMIN_DISCORD_IDS: '9', ...e });
    expect(effectiveAdminIds(c({ AUTH_MOCK: '1', AUTH_MOCK_ADMIN: '1' }))).toEqual(['9', 'mock-1']);
    expect(effectiveAdminIds(c({ AUTH_MOCK: '1' }))).toEqual(['9']);
    expect(effectiveAdminIds(c({ AUTH_MOCK_ADMIN: '1' }))).toEqual(['9']);
  });

  it('logout → 204, borra la sesión y expira la cookie; sin sesión → 401', async () => {
    const { app, f } = fakeDeps({ AUTH_MOCK: '1' });
    const token = cookieValue(await request(app).get('/api/v1/auth/discord'), 'bw_session') ?? '';
    const res = await request(app).post('/api/v1/auth/logout').set('Origin', SITE).set('Cookie', `bw_session=${token}`);
    expect(res.status).toBe(204);
    expect(f.sessions.size).toBe(0);
    expect(setCookieHeader(res, 'bw_session')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await request(app).post('/api/v1/auth/logout').set('Origin', SITE)).status).toBe(401);
  });
});

const testDb = withTestDb();

describe.skipIf(!testDb)('con MySQL', () => {
  it('upsertDiscordUser no duplica por discord_id y arma avatar_url', async () => {
    if (!testDb) return;
    await testDb.reset();
    const db = testDb.db;
    const a = await upsertDiscordUser(db, { id: '777', username: 'ana', globalName: 'Ana', avatar: 'abc' });
    const b = await upsertDiscordUser(db, { id: '777', username: 'ana2', globalName: null, avatar: null });
    expect(b).toBe(a);
    const rows = await db.select().from(users).where(eq(users.discordId, '777'));
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('ana2');
    expect(rows[0].avatarUrl).toBeNull();
    await upsertDiscordUser(db, { id: '778', username: 'x', globalName: null, avatar: 'h' });
    const [r] = await db.select().from(users).where(eq(users.discordId, '778'));
    expect(r.avatarUrl).toBe('https://cdn.discordapp.com/avatars/778/h.png');
  });

  it('login mock + logout crean y borran la fila de sesión', async () => {
    if (!testDb) return;
    await testDb.reset();
    const db = testDb.db;
    const config = loadConfig({ SUPERCELL_MOCK: '1', AUTH_MOCK: '1' });
    const app = createApp({
      logger: createLogger('silent'),
      health: () => ({}) as never,
      community: {
        db,
        sessions: createSessionStore(db),
        config,
        brawlerIds: async () => new Set<number>(),
        cache: createMemoryCache(),
      },
    });
    const token = cookieValue(await request(app).get('/api/v1/auth/discord'), 'bw_session') ?? '';
    const byId = () => db.select().from(sessions).where(eq(sessions.id, hashToken(token)));
    expect(await byId()).toHaveLength(1);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', config.publicSiteUrl)
      .set('Cookie', `bw_session=${token}`)
      .expect(204);
    expect(await byId()).toHaveLength(0);
  });
});
