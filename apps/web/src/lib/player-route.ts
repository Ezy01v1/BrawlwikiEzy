import { parseTag } from '@brawlwiki/shared/tags';
import type { TabItem } from '@/components/ui/Tabs';
import { PLAYER_TABS, type PlayerTab } from './search-params';

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

const TAB_LABELS: Record<PlayerTab, string> = { resumen: 'Resumen', brawlers: 'Brawlers', partidas: 'Partidas' };

export function playerTabs(tag: string, active: PlayerTab): TabItem[] {
  return PLAYER_TABS.map((t) => ({
    href: t === 'resumen' ? `/jugador/${tag}` : `/jugador/${tag}?tab=${t}`,
    label: TAB_LABELS[t],
    active: t === active,
  }));
}
