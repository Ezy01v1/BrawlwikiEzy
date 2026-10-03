import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBrawlerRankings, getClubRankings, getPlayerRankings } from '@/lib/queries';
import { type RankingView, regionLabel } from '@/lib/rankings';
import { LeaderboardList } from './LeaderboardList';

function NoRanking({ region }: { region: string }) {
  return (
    <EmptyState title="No hay ranking para esta región">
      Supercell no devolvió datos para {regionLabel(region)}. Prueba con otra región o con Global.
    </EmptyState>
  );
}

export async function RankingSection({ tipo, region, brawler }: RankingView) {
  if (tipo === 'clubes') {
    const r = await attempt(getClubRankings(region));
    if (!r.ok) return <ApiErrorView error={r.error} />;
    if (r.value.data.length === 0) return <NoRanking region={region} />;
    return (
      <>
        <StaleBadge meta={r.value.meta} />
        <LeaderboardList kind="clubs" items={r.value.data} />
      </>
    );
  }

  const r = await attempt(
    tipo === 'brawler' && brawler ? getBrawlerRankings(brawler, region) : getPlayerRankings(region),
  );
  if (!r.ok) return <ApiErrorView error={r.error} />;
  if (r.value.data.length === 0) return <NoRanking region={region} />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <LeaderboardList kind="players" items={r.value.data} />
    </>
  );
}
