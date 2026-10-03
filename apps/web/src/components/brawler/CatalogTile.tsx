import type { Brawler } from '@brawlwiki/shared';
import { rarityLabel } from '@/lib/catalog';
import { displayName } from '@/lib/format';
import { BrawlerCard } from './BrawlerCard';

export function CatalogTile({ brawler }: { brawler: Brawler }) {
  const name = displayName(brawler.name);
  const rarity = brawler.rarity ? rarityLabel(brawler.rarity.name) : null;
  return (
    <BrawlerCard
      name={name}
      imageUrl={brawler.imageUrl}
      color={brawler.rarity?.color ?? null}
      label={[name, rarity].filter(Boolean).join(', ')}
      href={`/brawlers/${brawler.id}`}
    >
      <span className="block truncate text-xs font-bold">{name}</span>
      {rarity && <span className="block truncate text-[10px] text-muted">{rarity}</span>}
    </BrawlerCard>
  );
}
