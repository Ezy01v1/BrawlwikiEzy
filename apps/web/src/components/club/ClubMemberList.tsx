import type { ClubMember } from '@brawlwiki/shared';
import Link from 'next/link';
import { EmptyState } from '@/components/states/EmptyState';
import { Chip } from '@/components/ui/Chip';
import { GameImage } from '@/components/ui/GameImage';
import { roleLabel } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

export function ClubMemberList({ members }: { members: ClubMember[] }) {
  return (
    <section aria-labelledby="miembros-title" className="min-w-0">
      <h2 id="miembros-title" className="mb-2 font-display text-lg">
        Miembros <span className="text-sm text-muted">({members.length})</span>
      </h2>
      {members.length === 0 ? (
        <EmptyState title="Este club no tiene miembros" />
      ) : (
        <ol className="divide-y divide-border rounded-card border border-border bg-surface">
          {members.map((m, i) => (
            <li key={m.tag} className="relative flex min-h-14 items-center gap-3 px-3 py-2">
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">{i + 1}</span>
              <GameImage
                src={m.icon.imageUrl}
                alt={`Ícono de ${m.name}`}
                size={36}
                fallbackText={m.name}
                className="rounded-chip"
              />
              <span className="min-w-0 flex-1">
                <Link href={`/jugador/${m.tag}`} className="block truncate font-semibold underline underline-offset-2 after:absolute after:inset-0 after:content-['']">
                  {m.name}
                </Link>
                <span className="block truncate text-xs text-muted">#{m.tag}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-display tabular-nums">
                  {formatNumber(m.trophies)}
                  <span className="sr-only"> trofeos</span>
                </span>
                <Chip tone={m.role === 'president' ? 'accent' : 'neutral'}>{roleLabel(m.role)}</Chip>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
