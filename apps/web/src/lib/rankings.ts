import type { TabItem } from '@/components/ui/Tabs';

/** Cuántos puestos se piden por defecto (la API acepta de 1 a 200). */
export const RANKING_LIMIT = 50;

export const RANKING_TYPES = ['jugadores', 'clubes', 'brawler'] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

export function parseRankingType(value: string | undefined): RankingType {
  return (RANKING_TYPES as readonly string[]).includes(value ?? '') ? (value as RankingType) : 'jugadores';
}

/** 'global' o un código de país de 2 letras en mayúsculas; cualquier otra cosa vuelve a 'global'. */
export function parseRegion(value: string | undefined): string {
  if (!value || value.toLowerCase() === 'global') return 'global';
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : 'global';
}

/** Países que se ofrecen en el selector: la comunidad hispanohablante primero, más algunos grandes. */
export const REGIONS = [
  'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'CU', 'PR',
  'ES', 'US', 'BR', 'CA', 'GB', 'FR', 'DE', 'IT', 'PT',
] as const;

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function regionLabel(region: string): string {
  if (region === 'global') return 'Global';
  try {
    return regionNames.of(region) ?? region;
  } catch {
    return region;
  }
}

export interface Option {
  value: string;
  label: string;
}

/** Global primero; el resto por nombre. La región actual se agrega aunque no esté en la lista (ej. ZZ). */
export function regionOptions(current: string): Option[] {
  const codes = new Set<string>(REGIONS);
  if (current !== 'global') codes.add(current);
  const countries = [...codes]
    .map((code) => ({ value: code, label: regionLabel(code) }))
    .sort((x, y) => x.label.localeCompare(y.label, 'es'));
  return [{ value: 'global', label: 'Global' }, ...countries];
}

export interface RankingView {
  tipo: RankingType;
  region: string;
  brawler: number | null;
}

export function rankingsHref({ tipo, region, brawler }: RankingView): string {
  const q = new URLSearchParams({ tipo });
  if (region !== 'global') q.set('region', region);
  if (tipo === 'brawler' && brawler) q.set('brawler', String(brawler));
  return `/rankings?${q.toString()}`;
}

const TAB_LABELS: Record<RankingType, string> = { jugadores: 'Jugadores', clubes: 'Clubes', brawler: 'Por brawler' };

export function rankingTabs(view: RankingView): TabItem[] {
  return RANKING_TYPES.map((tipo) => ({
    href: rankingsHref({ ...view, tipo, brawler: tipo === 'brawler' ? view.brawler : null }),
    label: TAB_LABELS[tipo],
    active: tipo === view.tipo,
  }));
}

export function rankingSubtitle(region: string, brawlerName?: string): string {
  return [`Top ${RANKING_LIMIT}`, regionLabel(region), brawlerName].filter(Boolean).join(' · ');
}
