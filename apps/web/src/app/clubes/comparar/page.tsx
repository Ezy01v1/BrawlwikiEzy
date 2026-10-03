import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareForm } from '@/components/club/CompareForm';
import { CompareResult } from '@/components/club/CompareResult';
import { CompareSkeleton } from '@/components/club/CompareSkeleton';
import { TagSearch } from '@/components/search/TagSearch';
import { parseCompareParams } from '@/lib/clubs';
import { first } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Clubes',
  description: 'Busca un club de Brawl Stars o compara dos clubes lado a lado.',
};

export default async function ClubsPage({ searchParams }: PageProps<'/clubes/comparar'>) {
  const sp = await searchParams;
  const p = parseCompareParams(first(sp.a), first(sp.b));
  const ready = p.a !== null && p.b !== null && !p.errors.a && !p.errors.b;

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Clubes</h1>
      <section aria-labelledby="buscar-club" className="mt-4 rounded-card border border-border bg-surface p-4">
        <h2 id="buscar-club" className="mb-2 font-display text-lg">
          Buscar un club
        </h2>
        <TagSearch variant="hero" target="club" />
      </section>
      <section aria-labelledby="comparar-title" className="mt-6">
        <h2 id="comparar-title" className="mb-2 font-display text-lg">
          Comparar dos clubes
        </h2>
        <CompareForm a={p.rawA} b={p.rawB} errors={p.errors} />
        {ready && (
          <Suspense key={`${p.a}-${p.b}`} fallback={<CompareSkeleton />}>
            <CompareResult a={p.a!} b={p.b!} />
          </Suspense>
        )}
      </section>
    </>
  );
}
