import type { CookieOptions, RequestHandler } from 'express';
import { dbCall, SESSION_TTL_MS, type SessionStore } from '../community/sessions';
import type { Config } from '../config';
import { AppError } from '../errors';

export const SESSION_COOKIE = 'bw_session';

export function sessionCookieOptions(config: Pick<Config, 'nodeEnv'>): CookieOptions {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/** Parser mínimo de `Cookie:`; ignora pares mal formados y no falla con %-escapes rotos. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Pone `req.user` si la cookie de sesión es válida; nunca rechaza por falta de sesión. */
export function loadUser(store: SessionStore, adminIds: string[]): RequestHandler {
  const admins = new Set(adminIds);
  return async (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const user = await dbCall(() => store.resolve(token));
      if (user) req.user = { ...user, isAdmin: admins.has(user.discordId) };
    }
    next();
  };
}

export function requireUser(): RequestHandler {
  return (req, _res, next) => next(req.user ? undefined : new AppError('UNAUTHENTICATED'));
}

/** Las rutas de admin no revelan su existencia: 404 a quien no es admin. */
export function requireAdmin(): RequestHandler {
  return (req, _res, next) => next(req.user?.isAdmin ? undefined : new AppError('NOT_FOUND'));
}
