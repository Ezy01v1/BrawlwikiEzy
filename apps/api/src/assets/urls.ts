/** Patrones del CDN de Brawlify, verificados el 2026-09-29. Un ID inexistente devuelve 404: el frontend muestra un fallback. */
export const CDN_BASE = 'https://cdn.brawlify.com';

export const brawlerImageUrl = (id: number): string => `${CDN_BASE}/brawlers/borderless/${id}.png`;
export const profileIconUrl = (id: number): string => `${CDN_BASE}/profile-icons/regular/${id}.png`;
export const clubBadgeUrl = (id: number): string => `${CDN_BASE}/club-badges/regular/${id}.png`;
export const mapImageUrl = (id: number | null | undefined): string | null =>
  id ? `${CDN_BASE}/maps/regular/${id}.png` : null;
