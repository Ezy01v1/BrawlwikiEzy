import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { type EditorBrawler, TierEditor } from '@/components/tierlist/TierEditor';
import { COMMUNITY_UNAVAILABLE, loginHref, NO_ACTIVE_SEASON_MESSAGE } from '@/lib/account';
import { attempt } from '@/lib/attempt';
import { displayName } from '@/lib/format';
import { getBrawlers, getMyTierList } from '@/lib/queries';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Armar mi tier list', robots: { index: false } };

const PATH = '/tierlist/editar';

function Unavailable() {
  return (
    <div role="alert" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
      <h2 className="font-display text-xl">{COMMUNITY_UNAVAILABLE}</h2>
      <p className="mt-2 text-sm text-muted">El resto de BrawlWiki sigue funcionando. Vuelve a intentarlo en un rato.</p>
    </div>
  );
}

export default async function TierEditPage() {
  const title = <h1 className="mt-6 font-display text-3xl">Armar mi tier list</h1>;
  const { enabled, user } = await getSession();
  if (!enabled) {
    return (
      <>
        {title}
        <Unavailable />
      </>
    );
  }
  if (!user) redirect(loginHref(PATH));

  const [mine, brawlers] = await Promise.all([attempt(getMyTierList()), attempt(getBrawlers())]);
  // La sesión pudo vencer entre /me y /tierlist/me: como cualquier página 🔒, al login.
  if (!mine.ok && mine.error.code === 'UNAUTHENTICATED') redirect(loginHref(PATH));

  const back = (
    <Link href="/tierlist" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
      Ver la tier list de la comunidad
    </Link>
  );

  if (!mine.ok) {
    const { error } = mine;
    return (
      <>
        {title}
        {error.code === 'NO_ACTIVE_SEASON' ? (
          <EmptyState title={NO_ACTIVE_SEASON_MESSAGE}>
            Cuando un administrador abra la próxima temporada vas a poder armar tu tier list. {back}
          </EmptyState>
        ) : error.code === 'DB_UNAVAILABLE' ? (
          <Unavailable />
        ) : (
          <ApiErrorView error={error} />
        )}
      </>
    );
  }
  if (!brawlers.ok) {
    return (
      <>
        {title}
        <ApiErrorView error={brawlers.error} />
      </>
    );
  }

  const { season, votes } = mine.value.data;
  const list: EditorBrawler[] = brawlers.value.data.map((b) => ({
    id: b.id,
    name: displayName(b.name),
    imageUrl: b.imageUrl,
    color: b.rarity?.color ?? null,
  }));

  return (
    <>
      {title}
      <p className="mt-1 text-sm text-muted">
        {season.name} · Toca un brawler para elegir su tier. Al terminar, guarda.
      </p>
      {back}
      <TierEditor season={{ id: season.id, name: season.name }} brawlers={list} initialVotes={votes} />
    </>
  );
}
