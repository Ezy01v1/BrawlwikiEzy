import { DEFAULT_COOLDOWN_SECONDS } from '../cache/policies';
import { AppError } from '../errors';
import type { Logger } from '../logger';
import { createLimiter } from './limiter';
import type { SupercellApi } from './types';

export interface SupercellClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxConcurrent?: number;
  retryDelayMs?: number;
  logger?: Logger;
}

/** Marca un fallo transitorio (red, timeout, 5xx) que merece un reintento. */
class Retryable {
  constructor(readonly error: AppError) {}
}

function parseRetryAfter(value: string | null): number {
  const n = value === null ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COOLDOWN_SECONDS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createSupercellClient(opts: SupercellClientOptions): SupercellApi {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retryDelayMs = opts.retryDelayMs ?? 300;
  const limit = createLimiter(opts.maxConcurrent ?? 8);

  async function once<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new Retryable(new AppError('UPSTREAM_UNAVAILABLE', undefined, { cause }));
    }

    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch (cause) {
        throw new AppError('UPSTREAM_UNAVAILABLE', undefined, { cause });
      }
    }

    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    if (res.status === 404) throw new AppError('NOT_FOUND');
    if (res.status === 429) {
      throw new AppError('UPSTREAM_RATE_LIMITED', undefined, {
        retryAfter: parseRetryAfter(res.headers.get('retry-after')),
      });
    }
    if (res.status === 503 && body.reason === 'inMaintenance') throw new AppError('UPSTREAM_MAINTENANCE');
    if (res.status === 403) {
      opts.logger?.error(
        { status: 403, reason: body.reason, path },
        'Supercell rechazó la petición: ¿key inválida o IP no autorizada?',
      );
      throw new AppError('UPSTREAM_UNAVAILABLE');
    }
    if (res.status >= 500) throw new Retryable(new AppError('UPSTREAM_UNAVAILABLE'));
    throw new AppError('UPSTREAM_UNAVAILABLE');
  }

  function request<T>(path: string): Promise<T> {
    return limit(async () => {
      try {
        return await once<T>(path);
      } catch (e) {
        if (!(e instanceof Retryable)) throw e;
        await sleep(retryDelayMs + Math.random() * 200 * Math.sign(retryDelayMs));
        try {
          return await once<T>(path);
        } catch (e2) {
          throw e2 instanceof Retryable ? e2.error : e2;
        }
      }
    });
  }

  const tagPath = (tag: string) => `%23${tag}`;

  return {
    mode: 'live',
    getPlayer: (tag) => request(`/players/${tagPath(tag)}`),
    getBattleLog: (tag) => request(`/players/${tagPath(tag)}/battlelog`),
    getClub: (tag) => request(`/clubs/${tagPath(tag)}`),
    getPlayerRankings: (region, n) => request(`/rankings/${region}/players?limit=${n}`),
    getClubRankings: (region, n) => request(`/rankings/${region}/clubs?limit=${n}`),
    getBrawlerRankings: (region, id, n) => request(`/rankings/${region}/brawlers/${id}?limit=${n}`),
    getBrawlers: () => request('/brawlers'),
    getEventRotation: () => request('/events/rotation'),
  };
}
