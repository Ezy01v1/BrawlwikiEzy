import { apiBaseUrl } from './api';
import { siteOrigin } from './site';

/** El callback canjea el `code` con Discord (dos llamadas de hasta 8 s cada una en la API). */
export const AUTH_PROXY_TIMEOUT_MS = 20_000;
export const LOGIN_ERROR_PATH = '/?login=error';

function redirectTo(location: string, status: 302 | 303, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return new Response(null, { status, headers });
}

/** Cookie y XFF del navegador tal cual; la API lee `bw_session`/`bw_oauth` y la IP para el rate limit y los logs. */
function forwardedHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  if (cookie) headers.Cookie = cookie;
  const xff = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  if (xff) headers['X-Forwarded-For'] = xff;
  return headers;
}

/** `logPath` es la ruta sin query: la del callback lleva `code` y `state`, que no van a los logs. */
async function callApi(path: string, logPath: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_PROXY_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[auth] la API no respondió', logPath, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * GET /auth/discord y /auth/discord/callback: reenvía la query sin tocarla (`next`, `code`, `state`, `error`)
 * y devuelve el redirect de la API tal cual, con todos sus `Set-Cookie`.
 */
export async function proxyLoginRedirect(
  req: Request,
  apiPath: '/auth/discord' | '/auth/discord/callback',
): Promise<Response> {
  const { search } = new URL(req.url);
  const res = await callApi(`${apiPath}${search}`, apiPath, { method: 'GET', headers: forwardedHeaders(req) });
  if (!res) return redirectTo(LOGIN_ERROR_PATH, 302);

  const cookies = res.headers.getSetCookie();
  const location = res.headers.get('location');
  if (res.status < 300 || res.status >= 400 || !location) {
    console.error('[auth] la API no redirigió', apiPath, res.status);
    await res.body?.cancel().catch(() => {});
    return redirectTo(LOGIN_ERROR_PATH, 302, cookies);
  }
  await res.body?.cancel().catch(() => {});
  return redirectTo(location, 302, cookies);
}

/**
 * POST /auth/logout: reenvía el `Origin` del navegador (la API rechaza uno ajeno) y vuelve a `/` con 303,
 * para que el navegador siga el redirect con GET. La cookie expirada viaja en el `Set-Cookie`.
 */
export async function proxyLogout(req: Request): Promise<Response> {
  const headers = { ...forwardedHeaders(req), Origin: req.headers.get('origin') ?? siteOrigin() };
  const res = await callApi('/auth/logout', '/auth/logout', { method: 'POST', headers });
  if (!res) return redirectTo(LOGIN_ERROR_PATH, 303);
  await res.body?.cancel().catch(() => {});
  return redirectTo('/', 303, res.headers.getSetCookie());
}
