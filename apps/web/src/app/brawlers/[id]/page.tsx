import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BrawlerDetail } from '@/components/brawler/BrawlerDetail';
import { BrawlerTopPlayers, TOP_PLAYERS } from '@/components/brawler/BrawlerTopPlayers';
import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { displayName } from '@/lib/format';
import { getBrawler, getBrawlerRankings } from '@/lib/queries';
import { rankingsHref } from '@/lib/rankings';
import { parseBrawlerIdParam } from '@/lib/route-params';

export async function generateMetadata({ params }: PageProps<'/brawlers/[id]'>): Promise<Metadata> {
  const id = parseBrawlerIdParam((await params).id);
  if (!id) return { title: 'Brawler' };
  const r = await attempt(getBrawler(id));
  if (!r.ok) return { title: 'Brawler' };
  const name = displayName(r.value.data.name);
  return {
    title: name,
    description: `${name} en Brawl Stars: rareza, clase, gadgets, habilidades estelares y los mejores jugadores.`,
  };
}

export default async function BrawlerPage({ params }: PageProps<'/brawlers/[id]'>) {
  const id = parseBrawlerIdParam((await params).id);
  if (!id) notFound();

  // Precarga el ranking en paralelo; `cache()` le entrega la misma promesa a BrawlerTopPlayers.
  void getBrawlerRankings(id, 'global', TOP_PLAYERS).catch(() => {});

  const r = await attempt(getBrawler(id));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND' || r.error.code === 'INVALID_PARAM') notFound();
    return <ApiErrorView error={r.error} />;
  }

  return (
    <>
      <Link href="/brawlers" className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←&nbsp;</span>Todos los brawlers
      </Link>
      <StaleBadge meta={r.value.meta} />
      <BrawlerDetail brawler={r.value.data} />
      <section aria-labelledby="top-title" className="mt-8">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-title" className="font-display text-lg">
            Mejores jugadores
          </h2>
          <Link
            href={rankingsHref({ tipo: 'brawler', region: 'global', brawler: id })}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-2"
          >
            Ver ranking completo
          </Link>
        </div>
        <Suspense fallback={<LeaderboardSkeleton rows={5} />}>
          <BrawlerTopPlayers id={id} />
        </Suspense>
      </section>
    </>
  );
}
