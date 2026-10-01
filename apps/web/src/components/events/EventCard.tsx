import type { EventSlot } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { timeLeft } from '@/lib/format';
import { modeName } from '@/lib/modes';

export function EventCard({ slot, now }: { slot: EventSlot; now: number }) {
  const map = slot.map.name ?? 'Mapa desconocido';
  const left = timeLeft(slot.endTime, now);
  return (
    <article className="flex items-center gap-3 rounded-card border border-border bg-surface p-2">
      <GameImage src={slot.map.imageUrl} alt={`Mapa ${map}`} size={56} fallbackText={map} className="rounded-chip object-cover" />
      <div className="min-w-0">
        <h3 className="truncate font-display text-base">{modeName(slot.mode.name)}</h3>
        <p className="truncate text-sm">{map}</p>
        <p className="text-xs text-muted">{left === 'terminado' ? 'Terminado' : `Termina en ${left}`}</p>
      </div>
    </article>
  );
}
