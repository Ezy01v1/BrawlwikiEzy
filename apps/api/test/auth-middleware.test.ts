import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMemoryCache } from '../src/cache/memory';
import type { CommunityDeps } from '../src/community/router';
import type { SessionStore, SessionUser } from '../src/community/sessions';
import { loadConfig } from '../src/config';
import {
  loadUser,
  parseCookies,
  requireAdmin,
  requireUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../src/http/auth';
import { errorHandler } from '../src/http/error-handler';
import { checkOrigin } from '../src/http/origin';
import { createLogger } from '../src/logger';

const ANA: SessionUser = { id: 1, discordId: '42', username: 'Ana', avatarUrl: null, playerTag: null };

function fakeStore(tokens: Record<string, SessionUser>, fail = false): SessionStore {
  return {
    create: async () => 'x',
    resolve: async (t) => {
      if (fail) throw new Error('db down');
      return tokens[t] ?? null;
    },
    destroy: async () => {},
  };
}

function harness(...mw: RequestHandler[]) {
  const app = express();
  for (const m of mw) app.use(m);
  app.all('/t', (req, res) => {
    res.json({ user: req.user ?? null });
  });
  app.use(errorHandler(createLogger('silent')));
  return app;
}

describe('parseCookies', () => {
  it('parsea, decodifica y tolera basura', () => {
    expect(parseCookies('a=1; bw_session=x%2By; =z; junk; b=%E0%A4%A')).toEqual({
      a: '1',
      bw_session: 'x+y',
      b: '%E0%A4%A',
    });
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe('sessionCookieOptions', () => {
  it('flags de la cookie', () => {
    const base = loadConfig({ SUPERCELL_MOCK: '1' });
    expect(SESSION_COOKIE).toBe('bw_session');
    expect(sessionCookieOptions(base)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000,
    });
    expect(sessionCookieOptions({ ...base, nodeEnv: 'production' }).secure).toBe(true);
  });
});

describe('loadUser', () => {
  const store = fakeStore({ good: ANA });

  it('cookie válida → req.user con isAdmin', async () => {
    const res = await request(harness(loadUser(store, ['42'])))
      .get('/t')
      .set('Cookie', `${SESSION_COOKIE}=good`);
    expect(res.body.user).toEqual({ ...ANA, isAdmin: true });
  });

  it('token basura o sin cookie → sigue sin usuario', async () => {
    const app = harness(loadUser(store, []));
    expect((await request(app).get('/t').set('Cookie', `${SESSION_COOKIE}=basura`)).body.user).toBeNull();
    expect((await request(app).get('/t').set('Cookie', 'garbage;;==;')).body.user).toBeNull();
    expect((await request(app).get('/t')).body.user).toBeNull();
  });

  it('si la DB falla → 503 DB_UNAVAILABLE', async () => {
    const res = await request(harness(loadUser(fakeStore({}, true), [])))
      .get('/t')
      .set('Cookie', `${SESSION_COOKIE}=good`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
  });
});

describe('requireUser / requireAdmin', () => {
  const store = fakeStore({ good: ANA });

  it('requireUser sin usuario → 401 UNAUTHENTICATED', async () => {
    const res = await request(harness(loadUser(store, []), requireUser())).get('/t');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('requireAdmin: no admin o anónimo → 404; admin pasa', async () => {
    const no = await request(harness(loadUser(store, []), requireAdmin()))
      .get('/t')
      .set('Cookie', `${SESSION_COOKIE}=good`);
    expect(no.status).toBe(404);
    expect(no.body.error.code).toBe('NOT_FOUND');
    expect((await request(harness(loadUser(store, []), requireAdmin())).get('/t')).status).toBe(404);
    const yes = await request(harness(loadUser(store, ['42']), requireAdmin()))
      .get('/t')
      .set('Cookie', `${SESSION_COOKIE}=good`);
    expect(yes.status).toBe(200);
  });
});

describe('checkOrigin', () => {
  const app = harness(checkOrigin('http://localhost:3200'));

  it('GET sin Origin pasa', async () => {
    expect((await request(app).get('/t')).status).toBe(200);
  });

  it('POST con el Origin del sitio pasa', async () => {
    expect((await request(app).post('/t').set('Origin', 'http://localhost:3200')).status).toBe(200);
  });

  it('POST con Origin ajeno o sin Origin → 403 FORBIDDEN', async () => {
    const evil = await request(app).post('/t').set('Origin', 'https://evil.example');
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe('FORBIDDEN');
    for (const m of ['post', 'put', 'patch', 'delete'] as const) {
      expect((await request(app)[m]('/t')).status).toBe(403);
    }
  });
});

describe('createApp con community', () => {
  it('monta checkOrigin bajo /api/v1 solo con deps.community', async () => {
    const config = loadConfig({ SUPERCELL_MOCK: '1' });
    const community: CommunityDeps = {
      db: {} as CommunityDeps['db'],
      sessions: fakeStore({}),
      config,
      brawlerIds: async () => new Set<number>(),
      cache: createMemoryCache(),
    };
    const base = { logger: createLogger('silent'), health: () => ({}) as never };
    const withC = createApp({ ...base, community });
    expect((await request(withC).post('/api/v1/nada').set('Origin', 'https://evil.example')).status).toBe(403);
    const without = createApp(base);
    expect((await request(without).post('/api/v1/nada').set('Origin', 'https://evil.example')).status).toBe(404);
  });
});
