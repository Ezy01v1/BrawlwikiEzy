import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMemoryCache } from '../src/cache/memory';
import type { CommunityDeps } from '../src/community/router';
import type { SessionStore } from '../src/community/sessions';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/logger';
import { OAUTH_COOKIE } from '../src/routes/auth';

const SITE = 'http://localhost:3200';
const PROFILE = { id: '777', username: 'ana', global_name: 'Ana', avatar: null };

/** Discord falso: token y perfil siempre válidos. */
const discordFetch = (async (url: string) =>
  String(url).endsWith('/oauth2/token')
    ? new Response(JSON.stringify({ access_token: 'DISCORDACCESS', token_type: 'Bearer' }), { status: 200 })
    : new Response(JSON.stringify(PROFILE), { status: 200 })) as typeof fetch;

/** App de Comunidad sin DB cuyo logger (nivel trace) escribe en `lines`. */
function loggedApp(lines: string[], env: Record<string, string>) {
  const logger = createLogger('trace', { write: (s: string) => void lines.push(s) });
  const tokens = new Map<string, number>();
  let seq = 0;
  const sessions: SessionStore = {
    async create(userId) {
      const t = `SECRETSESSIONTOKEN${++seq}x${env.AUTH_MOCK ?? '0'}`;
      tokens.set(t, userId);
      return t;
    },
    async resolve(t) {
      const id = tokens.get(t);
      return id === undefined ? null : { id, discordId: '777', username: 'Ana', avatarUrl: null, playerTag: null };
    },
    async destroy(t) {
      tokens.delete(t);
    },
  };
  const community: CommunityDeps = {
    db: {} as CommunityDeps['db'],
    sessions,
    config: loadConfig({ SUPERCELL_MOCK: '1', DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec', ...env }),
    brawlerIds: async () => new Set<number>(),
    cache: createMemoryCache(),
    fetchImpl: discordFetch,
    upsertUser: async () => 1,
  };
  return createApp({ logger, health: () => ({}) as never, community });
}

function cookieValue(res: request.Response, name: string): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${name}=`)) ?? '';
  return decodeURIComponent((c.split(';')[0] ?? '').slice(name.length + 1));
}

describe('los logs de las peticiones no filtran sesiones ni el OAuth', () => {
  it('ni el token de sesión, ni code/state, ni los valores de bw_session/bw_oauth', async () => {
    const lines: string[] = [];
    const secrets: string[] = ['SECRETCODE', 'SECRETSTATE'];

    // Login mock + petición autenticada + logout.
    const mock = loggedApp(lines, { AUTH_MOCK: '1' });
    const mockToken = cookieValue(await request(mock).get('/api/v1/auth/discord?next=/cuenta'), 'bw_session');
    expect(mockToken).toMatch(/^SECRETSESSIONTOKEN/);
    secrets.push(mockToken);
    const me = await request(mock).get('/api/v1/me').set('Cookie', `bw_session=${mockToken}`);
    expect(me.body.data.user.username).toBe('Ana');
    await request(mock)
      .post('/api/v1/auth/logout')
      .set('Origin', SITE)
      .set('Cookie', `bw_session=${mockToken}`)
      .expect(204);

    // OAuth real (Discord falso): inicio, callback con state ajeno y callback válido.
    const app = loggedApp(lines, {});
    const start = await request(app).get('/api/v1/auth/discord?next=/tierlist');
    const oauth = cookieValue(start, OAUTH_COOKIE);
    const { state } = JSON.parse(Buffer.from(oauth, 'base64url').toString()) as { state: string };
    secrets.push(oauth, state);
    const bad = await request(app)
      .get('/api/v1/auth/discord/callback?code=SECRETCODE&state=SECRETSTATE')
      .set('Cookie', `${OAUTH_COOKIE}=${oauth}`);
    expect(bad.headers.location).toBe('/tierlist?login=error');
    const ok = await request(app)
      .get(`/api/v1/auth/discord/callback?code=SECRETCODE&state=${state}`)
      .set('Cookie', `${OAUTH_COOKIE}=${oauth}`);
    const token = cookieValue(ok, 'bw_session');
    expect(token).toMatch(/^SECRETSESSIONTOKEN/);
    secrets.push(token);
    await request(app).get('/api/v1/me').set('Cookie', `bw_session=${token}; ${OAUTH_COOKIE}=${oauth}`).expect(200);

    const logs = lines.join('\n');
    // Hay logs de las peticiones (con la ruta), pero sin los secretos.
    expect(logs).toContain('/api/v1/auth/discord/callback');
    expect(logs).toContain('/api/v1/me');
    for (const s of secrets) expect(logs, s).not.toContain(s);
    expect(logs).not.toMatch(/bw_session=[^;\s"]/);
    expect(logs).not.toMatch(/bw_oauth=[^;\s"]/);
  });
});

describe('DB_UNAVAILABLE queda en los logs (warn), sin los parámetros de la consulta', () => {
  function failingApp(lines: string[], err: unknown) {
    const logger = createLogger('warn', { write: (s: string) => void lines.push(s) });
    const sessions: SessionStore = {
      create: async () => 'x',
      resolve: async () => {
        throw err;
      },
      destroy: async () => {},
    };
    const community: CommunityDeps = {
      db: {} as CommunityDeps['db'],
      sessions,
      config: loadConfig({ SUPERCELL_MOCK: '1' }),
      brawlerIds: async () => new Set<number>(),
      cache: createMemoryCache(),
    };
    return createApp({ logger, health: () => ({}) as never, community });
  }

  /** Como DrizzleQueryError: el mensaje trae la consulta y los parámetros; el error de mysql2 va en `cause`. */
  const drizzleError = (cause: unknown) =>
    new Error('Failed query: select `id` from `sessions` where `id` = ?\nparams: HASHDELASESION', { cause });

  it('conexión caída: requestId y code/errno/message de la causa', async () => {
    const lines: string[] = [];
    const conn = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
      code: 'ECONNREFUSED',
      errno: -4078,
    });
    const app = failingApp(lines, drizzleError(conn));
    const res = await request(app).get('/api/v1/me').set('Cookie', 'bw_session=TOKENDEPRUEBA');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');

    const entries = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const entry = entries.find((e) => e.msg === 'base de datos no disponible');
    expect(entry).toMatchObject({
      level: 40,
      requestId: res.body.error.requestId,
      db: { code: 'ECONNREFUSED', errno: -4078, message: 'connect ECONNREFUSED 127.0.0.1:3306' },
    });
    const logs = lines.join('\n');
    expect(logs).not.toContain('HASHDELASESION');
    expect(logs).not.toContain('TOKENDEPRUEBA');
  });

  it('error del servidor MySQL (con sqlState): solo code/errno/sqlState, sin el mensaje (puede traer valores)', async () => {
    const lines: string[] = [];
    const server = Object.assign(new Error("Duplicate entry 'VALORPRIVADO' for key 'PRIMARY'"), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
      sqlState: '23000',
      sql: "insert into `sessions` values ('VALORPRIVADO')",
    });
    const app = failingApp(lines, drizzleError(server));
    const res = await request(app).get('/api/v1/me').set('Cookie', 'bw_session=t');
    expect(res.status).toBe(503);
    const entry = lines.map((l) => JSON.parse(l) as Record<string, unknown>).find((e) => e.level === 40);
    expect(entry?.db).toEqual({ code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' });
    expect(lines.join('\n')).not.toContain('VALORPRIVADO');
    expect(lines.join('\n')).not.toContain('HASHDELASESION');
  });
});
