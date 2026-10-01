import type { Player } from '@brawlwiki/shared';
import Link from 'next/link';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { GameImage } from '@/components/ui/GameImage';

export function PlayerHeader({ player }: { player: Player }) {
  return (
    <header className="mt-4 flex items-center gap-3">
      <GameImage
        src={player.icon.imageUrl}
        alt={`Ícono de ${player.name}`}
        size={56}
        fallbackText={player.name}
        className="rounded-card"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl">{player.name}</h1>
        <p className="truncate text-sm text-muted">
          #{player.tag} · Nivel {player.expLevel}
          {player.club ? (
            <>
              {' · '}
              <Link href={`/club/${player.club.tag}`} className="text-fg underline-offset-2 hover:underline">
                {player.club.name}
              </Link>
            </>
          ) : (
            ' · Sin club'
          )}
        </p>
      </div>
      <FavoriteButton entry={{ type: 'player', tag: player.tag, name: player.name }} />
    </header>
  );
}
