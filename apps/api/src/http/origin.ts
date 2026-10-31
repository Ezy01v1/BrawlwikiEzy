import type { RequestHandler } from 'express';
import { AppError } from '../errors';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF: en métodos que modifican, `Origin` debe ser exactamente PUBLIC_SITE_URL. */
export function checkOrigin(publicSiteUrl: string): RequestHandler {
  const expected = new URL(publicSiteUrl).origin;
  return (req, _res, next) => {
    if (!UNSAFE.has(req.method)) return next();
    next(req.headers.origin === expected ? undefined : new AppError('FORBIDDEN'));
  };
}
