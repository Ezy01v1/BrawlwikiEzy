import type { Metadata } from 'next';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { SeasonPicker } from '@/components/tierlist/SeasonPicker';
import { TierBoard } from '@/components/tierlist/TierBoard';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { COMMUNITY_UNAVAILABLE, loginHref } from '@/lib/account';
import { attempt } from '@/lib/attempt';
import { plural } from '@/lib/format';
import { getBrawlers, getCommunityTierList, getSeasons } from '@/lib/queries';
import { first } from '@/lib/search-params';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Tier list',
  description: 'La tier list de la comunidad de Brawl Stars: los brawlers ordenados de S a D según los votos de los jugadores.',
};

/** Mismo formato que valida la API (entero positivo de hasta 9 dígitos); cualquier otra cosa se ignora y se ve la temporada actual. */
function parseSeason(value: string | undefined): number | undefined {
  return value !== undefined && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;
}

export default async function TierListPage({ searchParams }: PageProps<'/tierlist'>) {
  const sp = await searchParams;
  const [list, brawlers, seasons, session] = await Promise.all([
    attempt(getCommunityTierList(parseSeason(first(sp.season)))),
    attempt(getBrawlers()),
    attempt(getSeasons()),
    getSession(),
  ]);

  const title = <h1 className="mt-6 font-display text-3xl">Tier list</h1>;

  if (!list.ok) {
    const { error } = list;
    return (
      <>
        {title}
        {error.code === 'NOT_FOUND' ? (
          <EmptyState title="Todavía no hay una tier list">
            Un administrador abrirá la primera temporada y entonces podrás votar.
          </EmptyState>
        ) : error.code === 'DB_UNAVAILABLE' ? (
          <div role="alert" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
            <h2 className="font-display text-xl">{COMMUNITY_UNAVAILABLE}</h2>
            <p className="mt-2 text-sm text-muted">El resto de BrawlWiki sigue funcionando. Vuelve a intentarlo en un rato.</p>
          </div>
        ) : (
          <ApiErrorView error={error} />
        )}
      </>
    );
  }

  const { season, voters, rows } = list.value.data;
  return (
    <>
      {title}
      <p className="mt-1 text-sm text-muted">
        {season.name} · {plural(voters, 'votante', 'votantes')}
      </p>
      {seasons.ok && seasons.value.data.length > 0 && (
        <div className="mt-3">
          <SeasonPicker seasons={seasons.value.data} selectedId={season.id} />
        </div>
      )}
      {session.enabled && (
        <div className="mt-3">
          {session.user ? (
            <ButtonLink href="/tierlist/editar">Armar mi tier list</ButtonLink>
          ) : (
            // <a> y no <Link>: Next prefetchea los Link visibles y /auth/discord arranca el OAuth.
            <a href={loginHref('/tierlist')} className={buttonClass('secondary')}>
              Entra con Discord para votar
            </a>
          )}
        </div>
      )}
      {brawlers.ok ? <TierBoard rows={rows} brawlers={brawlers.value.data} /> : <ApiErrorView error={brawlers.error} />}
    </>
  );
}
