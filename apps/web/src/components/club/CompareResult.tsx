import type { Meta } from '@brawlwiki/shared';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import type { ApiError } from '@/lib/api';
import { attempt } from '@/lib/attempt';
import { getClub } from '@/lib/queries';
import { ClubCompare } from './ClubCompare';

function SideError({ tag, error }: { tag: string; error: ApiError }) {
  if (error.code === 'NOT_FOUND') {
    return <EmptyState title={`No encontramos el club #${tag}`}>Revisa el tag e inténtalo de nuevo.</EmptyState>;
  }
  return <ApiErrorView error={error} />;
}

/** El más viejo de los dos datos stale, si hay alguno. */
function oldestStale(metas: Meta[]): Meta | undefined {
  return metas.filter((m) => m.source === 'stale').sort((x, y) => y.ageSeconds - x.ageSeconds)[0];
}

export async function CompareResult({ a, b }: { a: string; b: string }) {
  const [ra, rb] = await Promise.all([attempt(getClub(a)), attempt(getClub(b))]);
  if (ra.ok && rb.ok) {
    const stale = oldestStale([ra.value.meta, rb.value.meta]);
    return (
      <>
        {stale && <StaleBadge meta={stale} />}
        <ClubCompare a={ra.value.data} b={rb.value.data} />
      </>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {!ra.ok && <SideError tag={a} error={ra.error} />}
      {!rb.ok && <SideError tag={b} error={rb.error} />}
    </div>
  );
}
