import type { Club } from '@brawlwiki/shared';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { CLUB_CAPACITY, summarizeClub } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

export function ClubStats({ club }: { club: Club }) {
  const s = summarizeClub(club);
  const stats = [
    { label: 'Miembros', value: `${s.members}/${CLUB_CAPACITY}` },
    { label: 'Promedio', value: formatNumber(s.average) },
    { label: 'Requeridos', value: formatNumber(club.requiredTrophies) },
  ];
  return (
    <section aria-label="Estadísticas del club">
      <Card>
        <p className="text-[11px] font-bold tracking-wider text-muted">TROFEOS</p>
        <AnimatedNumber value={club.trophies} className="font-display text-3xl text-primary" />
      </Card>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <div key={st.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{st.label}</dt>
            <dd className="font-display text-lg tabular-nums">{st.value}</dd>
          </div>
        ))}
      </dl>
      {club.description && (
        <p data-club-description className="mt-3 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm text-muted">
          {club.description}
        </p>
      )}
    </section>
  );
}
