import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { RankingFilters } from '@/components/rankings/RankingFilters';
import { RankingSection } from '@/components/rankings/RankingSection';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { attempt } from '@/lib/attempt';
import { sortByDisplayName } from '@/lib/brawlers';
import { displayName } from '@/lib/format';
import { getBrawlers } from '@/lib/queries';
import { parseRankingType, parseRegion, rankingSubtitle, rankingTabs } from '@/lib/rankings';
import { parseBrawlerIdParam } from '@/lib/route-params';
import { first } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Rankings',
  description: 'Top de jugadores, clubes y brawlers de Brawl Stars, global o por país.',
};

export default async function RankingsPage({ searchParams }: PageProps<'/rankings'>) {
  const sp = await searchParams;
  const tipo = parseRankingType(first(sp.tipo));
  const region = parseRegion(first(sp.region));
  const brawler = tipo === 'brawler' ? parseBrawlerIdParam(first(sp.brawler)) : null;

  const brawlersResult = tipo === 'brawler' ? await attempt(getBrawlers()) : null;
  const brawlers = brawlersResult?.ok ? sortByDisplayName(brawlersResult.value.data) : [];
  const selected = brawlers.find((b) => b.id === brawler);

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Rankings</h1>
      <p className="mt-1 text-sm text-muted">
        {rankingSubtitle(region, selected ? displayName(selected.name) : undefined)}
      </p>
      <Tabs label="Tipo de ranking" items={rankingTabs({ tipo, region, brawler })} />
      <RankingFilters tipo={tipo} region={region} brawler={brawler} brawlers={brawlers} />
      <div className="mt-4">
        {brawlersResult && !brawlersResult.ok ? (
          <ApiErrorView error={brawlersResult.error} />
        ) : tipo === 'brawler' && !brawler ? (
          <EmptyState title="Elige un brawler">Usa el selector para ver los mejores jugadores con ese brawler.</EmptyState>
        ) : (
          <Suspense key={`${tipo}-${region}-${brawler}`} fallback={<LeaderboardSkeleton />}>
            <RankingSection tipo={tipo} region={region} brawler={brawler} />
          </Suspense>
        )}
      </div>
    </>
  );
}
