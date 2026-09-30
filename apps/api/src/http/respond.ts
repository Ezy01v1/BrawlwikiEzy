import type { Response } from 'express';
import type { DataResult } from '../types';

const CACHE_STATUS = { fresh: 'MISS', cache: 'HIT', stale: 'STALE' } as const;

export function sendData<T>(res: Response, result: DataResult<T>, now: number = Date.now()): void {
  const ageSeconds = Math.max(0, Math.floor((now - result.fetchedAt) / 1000));
  res.setHeader('X-Cache-Status', CACHE_STATUS[result.source]);
  res.setHeader('X-Data-Age', String(ageSeconds));
  res.json({
    data: result.data,
    meta: {
      source: result.source,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      ageSeconds,
    },
  });
}
