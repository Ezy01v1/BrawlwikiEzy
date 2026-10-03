import type { Brawler } from '@brawlwiki/shared';
import { first } from './search-params';

const RARITY_ORDER = [
  'Starting Brawler',
  'Common',
  'Rare',
  'Super Rare',
  'Epic',
  'Mythic',
  'Legendary',
  'Ultra Legendary',
];

const RARITY_LABELS: Record<string, string> = {
  'Starting Brawler': 'Inicial',
  Common: 'Común',
  Rare: 'Raro',
  'Super Rare': 'Súper raro',
  Epic: 'Épico',
  Mythic: 'Mítico',
  Legendary: 'Legendario',
  'Ultra Legendary': 'Ultra legendario',
};

const CLASS_LABELS: Record<string, string> = {
  'Damage Dealer': 'Daño',
  Tank: 'Tanque',
  Support: 'Apoyo',
  Controller: 'Control',
  Assassin: 'Asesino',
  Marksman: 'Tirador',
  Artillery: 'Artillería',
};

export function rarityLabel(name: string): string {
  return RARITY_LABELS[name] ?? name;
}

export function classLabel(name: string): string {
  return CLASS_LABELS[name] ?? name;
}

export interface BrawlerFilters {
  q?: string;
  rareza?: string;
  clase?: string;
}

/** Minúsculas y sin acentos: "Shélly" encuentra a "SHELLY". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filterBrawlers(list: Brawler[], f: BrawlerFilters): Brawler[] {
  const q = f.q ? fold(f.q.trim()) : '';
  return list.filter(
    (b) =>
      (!f.rareza || b.rarity?.name === f.rareza) &&
      (!f.clase || b.class === f.clase) &&
      (!q || fold(b.name).includes(q)),
  );
}

export interface Facets {
  rarities: string[];
  classes: string[];
}

const rarityRank = (name: string) => {
  const i = RARITY_ORDER.indexOf(name);
  return i === -1 ? RARITY_ORDER.length : i;
};

/** Solo los valores que existen en la lista; vacío si la API todavía no tiene metadatos. */
export function brawlerFacets(list: Brawler[]): Facets {
  const rarities = [...new Set(list.flatMap((b) => (b.rarity ? [b.rarity.name] : [])))].sort(
    (a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b),
  );
  const classes = [...new Set(list.flatMap((b) => (b.class ? [b.class] : [])))].sort((a, b) =>
    classLabel(a).localeCompare(classLabel(b), 'es'),
  );
  return { rarities, classes };
}

export function parseBrawlerFilters(sp: Record<string, string | string[] | undefined>): BrawlerFilters {
  const read = (key: string) => first(sp[key])?.trim() || undefined;
  const out: BrawlerFilters = {};
  const q = read('q');
  const rareza = read('rareza');
  const clase = read('clase');
  if (q) out.q = q;
  if (rareza) out.rareza = rareza;
  if (clase) out.clase = clase;
  return out;
}
