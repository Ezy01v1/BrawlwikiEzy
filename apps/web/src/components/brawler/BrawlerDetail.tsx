import type { Brawler, NamedItem } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { classLabel, rarityLabel } from '@/lib/catalog';
import { displayName } from '@/lib/format';
import { NEUTRAL, tileBackground } from './BrawlerCard';

function ItemList({ id, title, items, empty }: { id: string; title: string; items: NamedItem[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <h2 id={id} className="mb-2 font-display text-lg">
        {title}
      </h2>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="rounded-chip bg-surface-2 px-3 py-2 text-sm">
              {displayName(item.name)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

export function BrawlerDetail({ brawler }: { brawler: Brawler }) {
  const name = displayName(brawler.name);
  const color = brawler.rarity?.color ?? null;
  return (
    <article aria-labelledby="brawler-name" className="mt-2 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
      <div className="overflow-hidden rounded-card border border-border">
        <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
          <GameImage src={brawler.imageUrl} alt={name} size={192} fallbackText={name} className="h-[85%] w-auto object-contain" />
        </div>
        <div aria-hidden="true" className="h-1" style={{ background: color ?? NEUTRAL }} />
      </div>
      <div className="min-w-0">
        <h1 id="brawler-name" className="truncate font-display text-3xl">
          {name}
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1">
            <dt className="text-muted">Rareza:</dt>
            <dd className="font-semibold">{brawler.rarity ? rarityLabel(brawler.rarity.name) : 'Sin dato'}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Clase:</dt>
            <dd className="font-semibold">{brawler.class ? classLabel(brawler.class) : 'Sin dato'}</dd>
          </div>
        </dl>
        <ItemList id="gadgets-title" title="Gadgets" items={brawler.gadgets} empty="Todavía no tiene gadgets." />
        <ItemList
          id="star-powers-title"
          title="Habilidades estelares"
          items={brawler.starPowers}
          empty="Todavía no tiene habilidades estelares."
        />
      </div>
    </article>
  );
}
