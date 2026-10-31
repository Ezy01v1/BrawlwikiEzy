import type { Brawler, TierLetter, TierRow } from '@brawlwiki/shared';
import { BrawlerCard } from '@/components/brawler/BrawlerCard';
import { rarityLabel } from '@/lib/catalog';
import { displayName, plural } from '@/lib/format';

/** Cada tier lleva un color de los tokens del tema, sobre `surface-2` (todos ≥ 4.5:1 en claro y oscuro). */
const SECTIONS: { key: TierLetter | null; title: string; badge: string }[] = [
  { key: 'S', title: 'S', badge: 'border-primary text-primary' },
  { key: 'A', title: 'A', badge: 'border-win text-win' },
  { key: 'B', title: 'B', badge: 'border-info text-info' },
  { key: 'C', title: 'C', badge: 'border-accent text-accent' },
  { key: 'D', title: 'D', badge: 'border-loss text-loss' },
  { key: null, title: 'Pocos votos', badge: 'border-border text-muted' },
];

interface Entry {
  row: TierRow;
  brawler: Brawler;
  name: string;
}

/** Filas S→D y "Pocos votos". Los brawlers que la API devuelve pero el catálogo no conoce se omiten. */
export function TierBoard({ rows, brawlers }: { rows: TierRow[]; brawlers: Brawler[] }) {
  const byId = new Map(brawlers.map((b) => [b.id, b]));
  const entries: Entry[] = [];
  for (const row of rows) {
    const brawler = byId.get(row.brawlerId);
    if (brawler) entries.push({ row, brawler, name: displayName(brawler.name) });
  }
  entries.sort((a, b) => b.row.average - a.row.average || b.row.votes - a.row.votes || a.name.localeCompare(b.name, 'es'));

  return (
    <div className="mt-4 flex flex-col gap-2">
      {SECTIONS.map((section) => {
        const id = `tier-${section.key ?? 'pocos'}`;
        const inSection = entries.filter((e) => e.row.tier === section.key);
        return (
          <section key={id} aria-labelledby={id} className="flex gap-2 rounded-card border border-border bg-surface p-2">
            <div className="flex w-14 shrink-0 items-center justify-center">
              <h2
                id={id}
                className={`flex min-h-14 w-full items-center justify-center rounded-chip border-2 bg-surface-2 text-center font-display ${section.badge} ${section.key ? 'text-3xl' : 'text-[11px] leading-tight'}`}
              >
                {section.title}
              </h2>
            </div>
            {inSection.length === 0 ? (
              <p className="flex min-h-14 flex-1 items-center text-sm text-muted">Sin brawlers</p>
            ) : (
              <ul className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                {inSection.map(({ row, brawler, name }) => {
                  const votes = plural(row.votes, 'voto', 'votos');
                  const rarity = brawler.rarity ? rarityLabel(brawler.rarity.name) : null;
                  return (
                    <li key={brawler.id}>
                      <BrawlerCard
                        name={name}
                        imageUrl={brawler.imageUrl}
                        color={brawler.rarity?.color ?? null}
                        label={[name, rarity, votes].filter(Boolean).join(', ')}
                        href={`/brawlers/${brawler.id}`}
                      >
                        <span className="block truncate text-xs font-bold">{name}</span>
                        <span className="block truncate text-[10px] text-muted">{votes}</span>
                      </BrawlerCard>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
