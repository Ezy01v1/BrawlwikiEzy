import { parseTag } from '@brawlwiki/shared';
import { AppError } from '../errors';

export function parseTagParam(value: unknown): string {
  const tag = typeof value === 'string' ? parseTag(value) : null;
  if (!tag) throw new AppError('INVALID_TAG');
  return tag;
}

export function parseRegion(value: unknown): string {
  if (value === undefined) return 'global';
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'global') return 'global';
    if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
  }
  throw new AppError('INVALID_PARAM', 'Región inválida. Usa "global" o un código de país de 2 letras (ej. MX).');
}

export function parseLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n >= 1 && n <= 200) return n;
  }
  throw new AppError('INVALID_PARAM', 'limit debe ser un entero entre 1 y 200.');
}

export function parseBrawlerId(value: unknown): number {
  if (typeof value === 'string' && /^\d{8}$/.test(value)) return Number(value);
  throw new AppError('INVALID_PARAM', 'Id de brawler inválido.');
}
