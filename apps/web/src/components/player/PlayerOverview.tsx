import type { Player } from '@brawlwiki/shared';
import { BrawlerTile } from '@/components/brawler/BrawlerTile';
import { EmptyState } from '@/components/states/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { sortBrawlers } from '@/lib/brawlers';

export function PlayerOverview({ player }: { player: Player }) {
  const top = sortBrawlers(player.brawlers, 'trofeos').slice(0, 3);
  return (
    <section aria-labelledby="top-title">
      <h2 id="top-title" className="mb-2 font-display text-lg">
        Mejores brawlers
      </h2>
      {top.length === 0 ? (
        <EmptyState title="Todavía no tiene brawlers" />
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {top.map((b) => (
            <li key={b.id}>
              <BrawlerTile brawler={b} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ButtonLink href={`/jugador/${player.tag}?tab=brawlers`} variant="secondary">
          Ver los {player.brawlers.length} brawlers
        </ButtonLink>
        <ButtonLink href={`/jugador/${player.tag}?tab=partidas`} variant="secondary">
          Ver partidas recientes
        </ButtonLink>
      </div>
    </section>
  );
}
