import type { TabItem } from '@/components/ui/Tabs';
import { PLAYER_TABS, type PlayerTab } from './search-params';

export { resolveTag } from './route-params';

const TAB_LABELS: Record<PlayerTab, string> = { resumen: 'Resumen', brawlers: 'Brawlers', partidas: 'Partidas' };

export function playerTabs(tag: string, active: PlayerTab): TabItem[] {
  return PLAYER_TABS.map((t) => ({
    href: t === 'resumen' ? `/jugador/${tag}` : `/jugador/${tag}?tab=${t}`,
    label: TAB_LABELS[t],
    active: t === active,
  }));
}
