import type { Club } from '@brawlwiki/shared';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { GameImage } from '@/components/ui/GameImage';
import type { FavoriteState } from '@/lib/account-favorites';
import { clubTypeLabel } from '@/lib/clubs';

export function ClubHeader({ club, favorite }: { club: Club; favorite: FavoriteState }) {
  return (
    <header className="mt-4 flex items-center gap-3">
      <GameImage
        src={club.badgeImageUrl}
        alt={`Escudo de ${club.name}`}
        size={56}
        fallbackText={club.name}
        className="rounded-card"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl">{club.name}</h1>
        <p className="truncate text-sm text-muted">
          #{club.tag} · {clubTypeLabel(club.type)}
        </p>
      </div>
      <FavoriteButton entry={{ type: 'club', tag: club.tag, name: club.name }} {...favorite} />
    </header>
  );
}
