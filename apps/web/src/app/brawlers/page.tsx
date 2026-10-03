import type { Metadata } from 'next';
import Link from 'next/link';
import { BrawlerFiltersForm } from '@/components/brawler/BrawlerFiltersForm';
import { CatalogTile } from '@/components/brawler/CatalogTile';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { sortByDisplayName } from '@/lib/brawlers';
import { brawlerFacets, filterBrawlers, parseBrawlerFilters } from '@/lib/catalog';
import { getBrawlers } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Brawlers',
  description: 'Catálogo de brawlers de Brawl Stars con rareza, clase, gadgets y habilidades estelares.',
};

export default async function BrawlersPage({ searchParams }: PageProps<'/brawlers'>) {
  const values = parseBrawlerFilters(await searchParams);
  const r = await attempt(getBrawlers());
  if (!r.ok) {
    return (
      <>
        <h1 className="mt-6 font-display text-3xl">Brawlers</h1>
        <ApiErrorView error={r.error} />
      </>
    );
  }

  const all = sortByDisplayName(r.value.data);
  const facets = brawlerFacets(all);
  const shown = filterBrawlers(all, values);
  const noMetadata = facets.rarities.length === 0 && facets.classes.length === 0;

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Brawlers</h1>
      <StaleBadge meta={r.value.meta} />
      <div className="mt-3">
        <BrawlerFiltersForm facets={facets} values={values} />
      </div>
      {noMetadata && <p className="mt-2 text-xs text-muted">La rareza y la clase todavía no están disponibles.</p>}
      <p role="status" className="mt-3 text-sm text-muted">
        Mostrando {shown.length} de {all.length} brawlers
      </p>
      {shown.length === 0 ? (
        <EmptyState title="Ningún brawler coincide">
          Prueba con otro nombre o{' '}
          <Link href="/brawlers" className="underline underline-offset-2">
            quita los filtros
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {shown.map((b) => (
            <li key={b.id}>
              <CatalogTile brawler={b} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
