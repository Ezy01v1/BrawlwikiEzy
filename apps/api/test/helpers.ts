import type { Express } from 'express';
import { type AppDeps, createApp } from '../src/app';
import type { Cache } from '../src/cache/cache';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { createHealth } from '../src/health';
import { createLogger } from '../src/logger';
import { createServices } from '../src/services';
import { createFixtureClient } from '../src/supercell/fixtures';
import type { SupercellApi } from '../src/supercell/types';

export type FakeResponse =
  | { status: number; body?: unknown; text?: string; headers?: Record<string, string> }
  | Error;

export function fakeFetch(responses: FakeResponse[] | ((url: string) => FakeResponse)) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const r = typeof responses === 'function' ? responses(url) : responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    const payload = r.text ?? JSON.stringify(r.body ?? {});
    return new Response(payload, {
      status: r.status,
      headers: { 'content-type': 'application/json', ...r.headers },
    });
  }) as typeof fetch;
  return { impl, calls };
}

export function createTestApp(
  opts: { supercell?: SupercellApi; now?: () => number; app?: Partial<AppDeps> } = {},
): { app: Express; cache: Cache; supercell: SupercellApi } {
  const supercell = opts.supercell ?? createFixtureClient({ slowMs: 10 });
  const cache = createMemoryCache({ now: opts.now });
  const { cachedFetch, isCoolingDown } = createCachedFetch({ cache, now: opts.now });
  const services = createServices({ supercell, cachedFetch, brawlerMeta: {} });
  const app = createApp({
    logger: createLogger('silent'),
    health: createHealth({ cache, supercell, isCoolingDown }),
    services,
    ...opts.app,
  });
  return { app, cache, supercell };
}
