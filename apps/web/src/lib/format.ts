const numberFormat = new Intl.NumberFormat('es-MX');

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return 'unos segundos';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  return `hace ${formatAge((now - Date.parse(iso)) / 1000)}`;
}

export function timeLeft(iso: string, now: number = Date.now()): string {
  const s = Math.floor((Date.parse(iso) - now) / 1000);
  if (s <= 0) return 'terminado';
  const m = Math.floor(s / 60);
  if (m < 1) return 'menos de 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** Supercell envía los nombres de brawlers en mayúsculas ("EL PRIMO"). */
export function displayName(raw: string): string {
  return raw.toLowerCase().replace(/(^|[\s\-.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
