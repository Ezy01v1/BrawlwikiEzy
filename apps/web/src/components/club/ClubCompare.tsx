import type { Club } from '@brawlwiki/shared';
import Link from 'next/link';
import { GameImage } from '@/components/ui/GameImage';
import { compareClubs, type Side } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

const SIDES: Side[] = ['a', 'b'];

export function ClubCompare({ a, b }: { a: Club; b: Club }) {
  const clubs = { a, b };
  const metrics = compareClubs(a, b);
  return (
    <section aria-labelledby="comparacion-title" className="mt-6">
      <h2 id="comparacion-title" className="sr-only">
        Comparación
      </h2>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {SIDES.map((side) => (
          <div key={side} className="flex min-w-0 items-center gap-2 rounded-card bg-surface-2 p-2">
            <GameImage
              src={clubs[side].badgeImageUrl}
              alt={`Escudo de ${clubs[side].name}`}
              size={32}
              fallbackText={clubs[side].name}
              className="rounded-chip"
            />
            <Link href={`/club/${clubs[side].tag}`} className="min-w-0 truncate font-display underline underline-offset-2">
              {clubs[side].name}
            </Link>
          </div>
        ))}
      </div>
      <ul className="space-y-3">
        {metrics.map((m) => {
          const max = Math.max(m.a, m.b);
          return (
            <li key={m.label} className="rounded-card border border-border bg-surface p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{m.label}</h3>
              {SIDES.map((side) => {
                const value = m[side];
                const lead = m.winner === side;
                const pct = max > 0 ? Math.round((value / max) * 100) : 0;
                return (
                  <div key={side} className="mt-2">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{clubs[side].name}</span>
                      <span className="shrink-0 font-bold tabular-nums">
                        {formatNumber(value)}
                        {lead && (
                          <span className="ml-1 text-xs text-primary">
                            <span aria-hidden="true">▲ </span>
                            Mayor
                          </span>
                        )}
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-surface-2">
                      <div
                        className={`h-2 rounded-full ${lead ? 'bg-primary-fill' : 'bg-muted'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
