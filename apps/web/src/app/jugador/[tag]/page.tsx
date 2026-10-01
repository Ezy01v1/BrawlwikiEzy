import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BrawlerGrid } from '@/components/brawler/BrawlerGrid';
import { BattleLogSection } from '@/components/player/BattleLogSection';
import { BattleLogSkeleton } from '@/components/player/BattleLogSkeleton';
import { InvalidTag } from '@/components/player/InvalidTag';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerOverview } from '@/components/player/PlayerOverview';
import { PlayerStats } from '@/components/player/PlayerStats';
import { RecordVisit } from '@/components/search/RecordVisit';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { Tabs } from '@/components/ui/Tabs';
import { attempt } from '@/lib/attempt';
import { parseOrder } from '@/lib/brawlers';
import { formatNumber } from '@/lib/format';
import { playerTabs, resolveTag } from '@/lib/player-route';
import { getPlayer } from '@/lib/queries';
import { first, parseTab } from '@/lib/search-params';

export async function generateMetadata({ params }: PageProps<'/jugador/[tag]'>): Promise<Metadata> {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return { title: 'Tag inválido' };
  if (tag !== raw) return {}; // la página redirige al tag canónico
  const r = await attempt(getPlayer(tag));
  if (!r.ok) return { title: `#${tag}` };
  const p = r.value.data;
  return {
    title: `${p.name} (#${p.tag})`,
    description: `${formatNumber(p.trophies)} trofeos · ${p.brawlers.length} brawlers · Nivel ${p.expLevel}. Stats de Brawl Stars en BrawlWiki.`,
  };
}

export default async function PlayerPage({ params, searchParams }: PageProps<'/jugador/[tag]'>) {
  const [{ tag: raw }, sp] = await Promise.all([params, searchParams]);
  const tag = resolveTag(raw);
  if (!tag) return <InvalidTag />;

  const tab = parseTab(first(sp.tab));
  if (tag !== raw) redirect(playerTabs(tag, tab).find((t) => t.active)!.href);

  const r = await attempt(getPlayer(tag));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND') notFound();
    if (r.error.code === 'INVALID_TAG') return <InvalidTag />;
    return <ApiErrorView error={r.error} />;
  }

  const { data: player, meta } = r.value;
  const order = parseOrder(first(sp.orden));

  return (
    <>
      <RecordVisit entry={{ type: 'player', tag: player.tag, name: player.name }} />
      <PlayerHeader player={player} />
      <StaleBadge meta={meta} />
      <div className="mt-2 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-0">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <Tabs label="Secciones del perfil" items={playerTabs(player.tag, tab)} />
        </div>
        <aside
          aria-label="Resumen del jugador"
          className={`lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-3 ${tab === 'resumen' ? '' : 'hidden lg:block'}`}
        >
          <PlayerStats player={player} />
        </aside>
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          {tab === 'resumen' && <PlayerOverview player={player} />}
          {tab === 'brawlers' && (
            <BrawlerGrid brawlers={player.brawlers} order={order} basePath={`/jugador/${player.tag}?tab=brawlers`} />
          )}
          {tab === 'partidas' && (
            <Suspense fallback={<BattleLogSkeleton />}>
              <BattleLogSection tag={player.tag} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
