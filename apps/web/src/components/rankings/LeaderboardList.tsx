import type { ClubRanking, PlayerRanking } from '@brawlwiki/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameImage } from '@/components/ui/GameImage';
import { formatNumber } from '@/lib/format';
import { RankBadge } from './RankBadge';

export type LeaderboardProps = { kind: 'players'; items: PlayerRanking[] } | { kind: 'clubs'; items: ClubRanking[] };

const ROW =
  'grid min-h-14 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,12rem)_7rem]';

interface RowProps {
  rank: number;
  image: ReactNode;
  href: string;
  name: string;
  detail: string;
  trophies: number;
}

/** Una sola fila para móvil y escritorio: en móvil el detalle va debajo del nombre; desde md, en su propia columna. */
function Row({ rank, image, href, name, detail, trophies }: RowProps) {
  return (
    <li className={ROW}>
      <span className="col-start-1 row-span-2 row-start-1 md:row-span-1">
        <RankBadge rank={rank} />
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
        {image}
        <Link href={href} className="min-w-0 truncate font-semibold underline underline-offset-2">
          {name}
        </Link>
      </span>
      <span className="col-start-2 row-start-2 truncate text-xs text-muted md:col-start-3 md:row-start-1 md:text-sm">
        {detail}
      </span>
      <span className="col-start-3 row-span-2 row-start-1 text-right font-display tabular-nums md:col-start-4 md:row-span-1">
        {formatNumber(trophies)}
        <span className="sr-only"> trofeos</span>
      </span>
    </li>
  );
}

export function LeaderboardList(props: LeaderboardProps) {
  const players = props.kind === 'players';
  return (
    <div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,12rem)_7rem] gap-x-3 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted md:grid"
      >
        <span>#</span>
        <span>{players ? 'Jugador' : 'Club'}</span>
        <span>{players ? 'Club' : 'Miembros'}</span>
        <span className="text-right">Trofeos</span>
      </div>
      <ol className="divide-y divide-border rounded-card border border-border bg-surface">
        {props.kind === 'players'
          ? props.items.map((p) => (
              <Row
                key={p.tag}
                rank={p.rank}
                href={`/jugador/${p.tag}`}
                name={p.name}
                detail={p.clubName ?? 'Sin club'}
                trophies={p.trophies}
                image={
                  <GameImage
                    src={p.icon.imageUrl}
                    alt={`Ícono de ${p.name}`}
                    size={32}
                    fallbackText={p.name}
                    className="rounded-chip"
                  />
                }
              />
            ))
          : props.items.map((c) => (
              <Row
                key={c.tag}
                rank={c.rank}
                href={`/club/${c.tag}`}
                name={c.name}
                detail={`${c.memberCount} miembros`}
                trophies={c.trophies}
                image={
                  <GameImage
                    src={c.badgeImageUrl}
                    alt={`Escudo de ${c.name}`}
                    size={32}
                    fallbackText={c.name}
                    className="rounded-chip"
                  />
                }
              />
            ))}
      </ol>
    </div>
  );
}
