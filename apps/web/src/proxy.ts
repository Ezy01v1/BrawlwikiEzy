import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/account';

/** Igual que SESSION_TTL_MS de la API: 30 días. */
const SESSION_MAX_AGE_S = 30 * 24 * 3600;

/**
 * La API extiende la sesión en MySQL, pero su `Set-Cookie` lo recibe el servidor de Next, no el navegador: sin esto
 * `bw_session` vencería a los 30 días del login aunque se use todos los días. Cada GET con sesión la vuelve a fijar.
 * Un token inválido también se renueva; es inofensivo, la API lo rechaza igual.
 */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Los POST son Server Actions (borrar la cuenta expira la cookie): no se pisan.
  if (!token || request.method !== 'GET') return res;
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

export const config = {
  // Fuera: /auth (login y logout fijan o expiran la cookie), `_next` y archivos con extensión.
  matcher: ['/((?!auth/|_next/|.*\\..*).*)'],
};
