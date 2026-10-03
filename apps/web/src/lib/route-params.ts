import { parseTag } from '@brawlwiki/shared/tags';

/** Normaliza el segmento [tag] de la URL; `null` si no es un tag válido. */
export function resolveTag(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return parseTag(decoded);
}

/** Los ids de brawler de Supercell tienen 8 dígitos (16000000…); cualquier otra cosa da `null`. */
export function parseBrawlerIdParam(raw: string | undefined): number | null {
  return raw !== undefined && /^\d{8}$/.test(raw) ? Number(raw) : null;
}
