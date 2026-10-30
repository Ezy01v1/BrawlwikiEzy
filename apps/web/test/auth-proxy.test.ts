import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as discordStart } from '@/app/auth/discord/route';
import { GET as discordCallback } from '@/app/auth/discord/callback/route';
import { POST as logout } from '@/app/auth/logout/route';

const API = 'http://api.test/api/v1';
const SITE = 'https://brawlwiki.test';

function apiResponse(status: number, opts: { location?: string; cookies?: string[]; body?: string } = {}) {
  const h = new Headers();
  if (opts.location) h.set('location', opts.location);
  for (const c of opts.cookies ?? []) h.append('set-cookie', c);
  return new Response(opts.body ?? null, { status, headers: h });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', API);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastCall = () => fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];

describe('GET /auth/discord/callback', () => {
  it('reenvía query, Cookie y XFF sin seguir redirects; copia Location y los dos Set-Cookie', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(302, {
        location: '/tierlist/editar',
        cookies: [
          'bw_oauth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
          'bw_session=tok; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax',
        ],
      }),
    );
    const res = await discordCallback(
      new Request(`${SITE}/auth/discord/callback?code=abc&state=xyz`, {
        headers: { cookie: 'bw_oauth=v1', 'x-forwarded-for': '203.0.113.5' },
      }),
    );

    const [url, init] = lastCall();
    expect(url).toBe(`${API}/auth/discord/callback?code=abc&state=xyz`);
    expect(init.redirect).toBe('manual');
    expect(init.method ?? 'GET').toBe('GET');
    const h = new Headers(init.headers);
    expect(h.get('cookie')).toBe('bw_oauth=v1');
    expect(h.get('x-forwarded-for')).toBe('203.0.113.5');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/tierlist/editar');
    expect(res.headers.getSetCookie()).toEqual([
      'bw_oauth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
      'bw_session=tok; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('el error de Discord viaja tal cual en la query', async () => {
    fetchMock.mockResolvedValue(apiResponse(302, { location: '/?login=error' }));
    const res = await discordCallback(
      new Request(`${SITE}/auth/discord/callback?error=access_denied&state=s%2Fx`),
    );
    expect(lastCall()[0]).toBe(`${API}/auth/discord/callback?error=access_denied&state=s%2Fx`);
    expect(new Headers(lastCall()[1].headers).has('cookie')).toBe(false);
    expect(res.headers.get('location')).toBe('/?login=error');
  });

  it('API caída → /?login=error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await discordCallback(new Request(`${SITE}/auth/discord/callback?code=secret&state=b`));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?login=error');
    // El code y el state de Discord no van a los logs.
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain('/auth/discord/callback');
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain('?');
  });
});

describe('GET /auth/discord', () => {
  it('reenvía next y pasa el redirect absoluto a Discord con su Set-Cookie', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(302, {
        location: 'https://discord.com/oauth2/authorize?client_id=1&state=z',
        cookies: ['bw_oauth=abc; Max-Age=600; Path=/; HttpOnly; SameSite=Lax'],
      }),
    );
    const res = await discordStart(new Request(`${SITE}/auth/discord?next=%2Ftierlist%3Fseason%3D2`));
    expect(lastCall()[0]).toBe(`${API}/auth/discord?next=%2Ftierlist%3Fseason%3D2`);
    expect(lastCall()[1].redirect).toBe('manual');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://discord.com/oauth2/authorize?client_id=1&state=z');
    expect(res.headers.getSetCookie()).toEqual(['bw_oauth=abc; Max-Age=600; Path=/; HttpOnly; SameSite=Lax']);
  });

  it('la API no redirige (Comunidad apagada → 404) → /?login=error', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(404, { body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x', requestId: 'r' } }) }),
    );
    const res = await discordStart(new Request(`${SITE}/auth/discord`));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?login=error');
  });
});

describe('POST /auth/logout', () => {
  it('manda POST con Cookie, Origin y XFF; copia Set-Cookie y redirige con 303 a /', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(204, { cookies: ['bw_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'] }),
    );
    const res = await logout(
      new Request(`${SITE}/auth/logout`, {
        method: 'POST',
        headers: { cookie: 'bw_session=tok', origin: SITE, 'x-real-ip': '198.51.100.9' },
      }),
    );
    const [url, init] = lastCall();
    expect(url).toBe(`${API}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    const h = new Headers(init.headers);
    expect(h.get('cookie')).toBe('bw_session=tok');
    expect(h.get('origin')).toBe(SITE);
    expect(h.get('x-forwarded-for')).toBe('198.51.100.9');

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    expect(res.headers.getSetCookie()).toEqual(['bw_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly']);
  });

  it('sin Origin del navegador usa NEXT_PUBLIC_SITE_URL; un Origin ajeno se reenvía tal cual (la API lo rechaza)', async () => {
    fetchMock.mockResolvedValue(apiResponse(204));
    await logout(new Request(`${SITE}/auth/logout`, { method: 'POST' }));
    expect(new Headers(lastCall()[1].headers).get('origin')).toBe(SITE);

    fetchMock.mockResolvedValue(
      apiResponse(403, { body: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'x', requestId: 'r' } }) }),
    );
    const res = await logout(
      new Request(`${SITE}/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.test' } }),
    );
    expect(new Headers(lastCall()[1].headers).get('origin')).toBe('https://evil.test');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
  });

  it('API caída → 303 a /?login=error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await logout(new Request(`${SITE}/auth/logout`, { method: 'POST' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/?login=error');
  });
});
