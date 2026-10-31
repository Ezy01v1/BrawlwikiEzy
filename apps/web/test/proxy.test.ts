import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from '@/proxy';

const req = (path: string, init: { method?: string; cookie?: string } = {}) =>
  new NextRequest(`https://brawlwiki.test${path}`, {
    method: init.method ?? 'GET',
    headers: init.cookie ? { cookie: init.cookie } : {},
  });

const sessionCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith('bw_session='));

afterEach(() => vi.unstubAllEnvs());

describe('proxy: renovar bw_session', () => {
  it('un GET con sesión vuelve a fijar la cookie por 30 días con los atributos de la API', () => {
    const c = sessionCookie(proxy(req('/tierlist', { cookie: 'theme=dark; bw_session=tok%2B1' })));
    expect(c).toMatch(/^bw_session=tok%2B1;/);
    expect(c).toMatch(/Max-Age=2592000/i);
    expect(c).toMatch(/Path=\//i);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).not.toMatch(/Secure/i);
  });

  it('en producción la cookie lleva Secure', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookie(proxy(req('/', { cookie: 'bw_session=tok' })))).toMatch(/Secure/i);
  });

  it('sin sesión no toca nada', () => {
    expect(sessionCookie(proxy(req('/tierlist', { cookie: 'theme=dark' })))).toBeUndefined();
  });

  it('no pisa lo que hacen los POST (Server Actions como borrar la cuenta)', () => {
    expect(sessionCookie(proxy(req('/cuenta', { method: 'POST', cookie: 'bw_session=tok' })))).toBeUndefined();
  });

  it('no corre en /auth (login y logout fijan o expiran la cookie) ni en estáticos', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ['/auth/logout', '/auth/discord/callback', '/_next/static/a.js', '/_next/image', '/favicon.ico']) {
      expect(matcher.test(p), p).toBe(false);
    }
    for (const p of ['/', '/tierlist', '/jugador/2PP', '/authors']) expect(matcher.test(p), p).toBe(true);
  });
});
