import type { PlayerBrawler } from '@brawlwiki/shared';
import Link from 'next/link';
import { BRAWLER_ORDERS, type BrawlerOrder, sortBrawlers } from '@/lib/brawlers';
import { BrawlerTile } from './BrawlerTile';

const ORDER_LABELS: Record<BrawlerOrder, string> = { trofeos: 'Trofeos', poder: 'Poder', nombre: 'Nombre' };

/** `basePath` ya incluye un query string (ej. "/jugador/2PP?tab=brawlers"). */
export function BrawlerGrid({ brawlers, order, basePath }: { brawlers: PlayerBrawler[]; order: BrawlerOrder; basePath: string }) {
  const sorted = sortBrawlers(brawlers, order);
  return (
    <section aria-labelledby="brawlers-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="brawlers-title" className="font-display text-lg">
          Brawlers <span className="text-sm text-muted">({brawlers.length})</span>
        </h2>
        <nav aria-label="Ordenar brawlers" className="flex gap-1">
          {BRAWLER_ORDERS.map((o) => (
            <Link
              key={o}
              href={`${basePath}&orden=${o}`}
              scroll={false}
              aria-current={o === order ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-chip px-3 text-xs font-semibold ${o === order ? 'bg-surface-2 text-primary' : 'text-muted hover:text-fg'}`}
            >
              {ORDER_LABELS[o]}
            </Link>
          ))}
        </nav>
      </div>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {sorted.map((b) => (
          <li key={b.id}>
            <BrawlerTile brawler={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}
