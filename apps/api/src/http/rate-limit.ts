import type { Request, RequestHandler } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import { AppError } from '../errors';

const WINDOW_MS = 60_000;

export function createGeneralLimiter(opts: { perMinute: number; store?: Store }): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: opts.perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    ...(opts.store ? { store: opts.store } : {}),
    skip: (req) => req.path === '/api/v1/health',
    handler: (req, _res, next) => {
      const reset = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : 60;
      next(new AppError('RATE_LIMITED', undefined, { retryAfter }));
    },
  });
}

export interface UpstreamGuard {
  check(key: string): void;
}

/** Ventana deslizante en memoria: cuántas consultas a Supercell provoca cada IP por minuto. */
export function createUpstreamGuard(opts: { perMinute: number; now?: () => number }): UpstreamGuard {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function prune(t: number) {
    if (hits.size < 10_000) return;
    for (const [k, list] of hits) {
      if (list.every((x) => t - x >= WINDOW_MS)) hits.delete(k);
    }
  }

  return {
    check(key) {
      const t = now();
      prune(t);
      const recent = (hits.get(key) ?? []).filter((x) => t - x < WINDOW_MS);
      if (recent.length >= opts.perMinute) {
        hits.set(key, recent);
        const retryAfter = Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - t) / 1000));
        throw new AppError('RATE_LIMITED', 'Estás buscando demasiados perfiles nuevos. Espera un momento.', {
          retryAfter,
        });
      }
      recent.push(t);
      hits.set(key, recent);
    },
  };
}
