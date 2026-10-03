import type { PlayerBrawler } from '@brawlwiki/shared';
import { rarityLabel } from '@/lib/catalog';
import { displayName, formatNumber } from '@/lib/format';
import { BrawlerCard } from './BrawlerCard';

export { tileBackground } from './BrawlerCard';

export function BrawlerTile({ brawler }: { brawler: PlayerBrawler }) {
  const name = displayName(brawler.name);
  const label = [
    name,
    `${formatNumber(brawler.trophies)} trofeos`,
    `poder ${brawler.power}`,
    brawler.rarity ? rarityLabel(brawler.rarity.name) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <BrawlerCard name={name} imageUrl={brawler.imageUrl} color={brawler.rarity?.color ?? null} label={label}>
      <span className="block truncate text-xs font-bold">{name}</span>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-muted">{formatNumber(brawler.trophies)}</span>
        <span className="text-[10px] font-bold tabular-nums">P{brawler.power}</span>
      </div>
    </BrawlerCard>
  );
}
