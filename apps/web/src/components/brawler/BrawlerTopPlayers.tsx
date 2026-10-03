import { LeaderboardList } from '@/components/rankings/LeaderboardList';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBrawlerRankings } from '@/lib/queries';

export const TOP_PLAYERS = 10;

export async function BrawlerTopPlayers({ id }: { id: number }) {
  const r = await attempt(getBrawlerRankings(id, 'global', TOP_PLAYERS));
  if (!r.ok) return <ApiErrorView error={r.error} />;
  if (r.value.data.length === 0) return <EmptyState title="Todavía no hay ranking para este brawler" />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <LeaderboardList kind="players" items={r.value.data} />
    </>
  );
}
