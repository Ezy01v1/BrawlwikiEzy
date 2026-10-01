import type { PlayerBrawler } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { displayName, formatNumber } from '@/lib/format';

const NEUTRAL = '#3a3a4a';

/** Arte sobre un fondo radial del color de rareza; la base oscura se mantiene en ambos temas, como una carta del juego. */
export function tileBackground(color: string | null): string {
  const c = color ?? NEUTRAL;
  return `radial-gradient(circle at 50% 35%, ${c} 0%, color-mix(in srgb, ${c} 30%, #0b0b0f) 75%)`;
}

export function BrawlerTile({ brawler }: { brawler: PlayerBrawler }) {
  const name = displayName(brawler.name);
  const color = brawler.rarity?.color ?? null;
  const label = [name, `${formatNumber(brawler.trophies)} trofeos`, `poder ${brawler.power}`, brawler.rarity?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      aria-label={label}
      className="overflow-hidden rounded-card border border-border bg-surface transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
        <GameImage src={brawler.imageUrl} alt={name} size={96} fallbackText={name} className="h-[85%] w-auto object-contain" />
      </div>
      <div aria-hidden="true" className="h-[3px]" style={{ background: color ?? NEUTRAL }} />
      <div className="space-y-1 px-2 py-1">
        <span className="block truncate text-xs font-bold">{name}</span>
        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums text-muted">{formatNumber(brawler.trophies)}</span>
          <span className="text-[10px] font-bold tabular-nums">P{brawler.power}</span>
        </div>
      </div>
    </article>
  );
}
