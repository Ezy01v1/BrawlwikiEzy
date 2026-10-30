import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let headerMap: Map<string, string>;
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k.toLowerCase()) ?? null }),
}));

const API = 'http://api.test/api/v1';
const META = { source: 'fresh', fetchedAt: '2026-10-29T12:00:00.000Z', ageSeconds: 0 };
const USER = { id: 7, username: 'Ezy', avatarUrl: null, playerTag: '2PP', isAdmin: false };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const apiErr = (status: number, code: string) => json(status, { error: { code, message: 'x', requestId: 'r' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', API);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://brawlwiki.test/');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  headerMap = new Map();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('requestContext', () => {
  it('lee XFF (o x-real-ip), la cookie y el origin del sitio', async () => {
    const { requestContext } = await import('@/lib/queries');
    headerMap = new Map([
      ['x-real-ip', '198.51.100.9'],
      ['cookie', 'bw_session=tok; theme=dark'],
    ]);
    expect(await requestContext()).toEqual({
      forwardedFor: '198.51.100.9',
      cookie: 'bw_session=tok; theme=dark',
      origin: 'https://brawlwiki.test',
    });
  });
});

describe('siteOrigin', () => {
  it('sin NEXT_PUBLIC_SITE_URL usa el puerto de desarrollo 3200 (el default de PUBLIC_SITE_URL en la API)', async () => {
    const { siteOrigin, DEFAULT_SITE_URL } = await import('@/lib/site');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    expect(DEFAULT_SITE_URL).toBe('http://localhost:3200');
    expect(siteOrigin()).toBe('http://localhost:3200');
  });
});

describe('getSession', () => {
  it('con sesión → enabled y el usuario; reenvía la cookie y XFF a GET /me', async () => {
    const { getSession, getMe } = await import('@/lib/session');
    headerMap = new Map([
      ['cookie', 'bw_session=tok'],
      ['x-forwarded-for', '203.0.113.5'],
    ]);
    fetchMock.mockImplementation(async () => json(200, { data: { user: USER }, meta: META }));
    expect(await getSession()).toEqual({ enabled: true, user: USER });
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/me`);
    const h = new Headers(init.headers);
    expect(h.get('cookie')).toBe('bw_session=tok');
    expect(h.get('x-forwarded-for')).toBe('203.0.113.5');
    expect(await getMe()).toEqual(USER);
  });

  it('anónimo con Comunidad activa → enabled sin usuario', async () => {
    const { getSession } = await import('@/lib/session');
    fetchMock.mockResolvedValue(json(200, { data: { user: null }, meta: META }));
    expect(await getSession()).toEqual({ enabled: true, user: null });
  });

  it('404 (modo v1), 503 DB_UNAVAILABLE o red caída → deshabilitada', async () => {
    const { getSession } = await import('@/lib/session');
    fetchMock.mockResolvedValueOnce(apiErr(404, 'NOT_FOUND'));
    expect(await getSession()).toEqual({ enabled: false, user: null });
    fetchMock.mockResolvedValueOnce(apiErr(503, 'DB_UNAVAILABLE'));
    expect(await getSession()).toEqual({ enabled: false, user: null });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await getSession()).toEqual({ enabled: false, user: null });
  });

  it('otro error de la API → deshabilitada y se registra', async () => {
    const { getSession } = await import('@/lib/session');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(apiErr(500, 'INTERNAL'));
    expect(await getSession()).toEqual({ enabled: false, user: null });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
