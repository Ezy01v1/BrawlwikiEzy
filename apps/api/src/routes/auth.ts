import { randomBytes } from 'node:crypto';
import { type Response, Router } from 'express';
import { createDiscordClient, type DiscordProfile, upsertDiscordUser } from '../community/discord';
import type { CommunityDeps } from '../community/router';
import { MOCK_DISCORD_ID } from '../config';
import { parseCookies, requireUser, SESSION_COOKIE, sessionCookieOptions } from '../http/auth';

export const OAUTH_COOKIE = 'bw_oauth';
const OAUTH_TTL_MS = 10 * 60 * 1000;

/** `next` válido: empieza con `/` y no con `//` ni `/\`; si no, `/`. */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

function withLoginError(next: string): string {
  return `${next}${next.includes('?') ? '&' : '?'}login=error`;
}

function readOauthCookie(raw: string | undefined): { state: string; next: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof v.state !== 'string' || !v.state) return null;
    return { state: v.state, next: safeNext(v.next) };
  } catch {
    return null;
  }
}

export function createAuthRouter(deps: CommunityDeps): Router {
  const { config, sessions } = deps;
  const router = Router();
  const upsert = deps.upsertUser ?? ((p: DiscordProfile) => upsertDiscordUser(deps.db, p));
  const discord = createDiscordClient({
    clientId: config.discordClientId ?? '',
    clientSecret: config.discordClientSecret ?? '',
    redirectUri: `${config.publicSiteUrl}/auth/discord/callback`,
    fetchImpl: deps.fetchImpl,
  });
  const oauthCookie = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/' } as const;

  async function startSession(res: Response, userId: number, next: string) {
    const token = await sessions.create(userId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config));
    res.redirect(302, next);
  }

  router.get('/discord', async (req, res) => {
    const next = safeNext(req.query.next);
    if (config.authMock) {
      const userId = await upsert({ id: MOCK_DISCORD_ID, username: 'MockUser', globalName: null, avatar: null });
      await startSession(res, userId, next);
      return;
    }
    const state = randomBytes(16).toString('base64url');
    const value = Buffer.from(JSON.stringify({ state, next })).toString('base64url');
    res.cookie(OAUTH_COOKIE, value, { ...oauthCookie, maxAge: OAUTH_TTL_MS });
    res.redirect(302, discord.authorizeUrl(state));
  });

  router.get('/discord/callback', async (req, res) => {
    const saved = readOauthCookie(parseCookies(req.headers.cookie)[OAUTH_COOKIE]);
    res.clearCookie(OAUTH_COOKIE, oauthCookie);
    const next = saved?.next ?? '/';
    const { state, code } = req.query;
    if (!saved || typeof state !== 'string' || state !== saved.state || typeof code !== 'string' || !code) {
      res.redirect(302, withLoginError(next));
      return;
    }
    let profile: DiscordProfile;
    try {
      profile = await discord.exchange(code);
    } catch (err) {
      req.log?.warn({ err }, 'login con Discord falló');
      res.redirect(302, withLoginError(next));
      return;
    }
    await startSession(res, await upsert(profile), next);
  });

  router.post('/logout', requireUser(), async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) await sessions.destroy(token);
    const { maxAge: _m, ...opts } = sessionCookieOptions(config);
    res.clearCookie(SESSION_COOKIE, opts);
    res.status(204).end();
  });

  return router;
}
