import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBattleLog } from '@/lib/queries';
import { BattleLog } from './BattleLog';

/** Va dentro de <Suspense>: si falla solo el battle log, el resto del perfil se ve igual. */
export async function BattleLogSection({ tag }: { tag: string }) {
  const r = await attempt(getBattleLog(tag));
  if (!r.ok) return <ApiErrorView error={r.error} />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <BattleLog battles={r.value.data} playerTag={tag} now={Date.now()} />
    </>
  );
}
