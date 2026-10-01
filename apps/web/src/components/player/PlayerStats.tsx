import type { Player } from '@brawlwiki/shared';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/format';

export function PlayerStats({ player }: { player: Player }) {
  const stats = [
    { label: 'Victorias 3vs3', value: player.victories.trio },
    { label: 'Victorias solo', value: player.victories.solo },
    { label: 'Victorias dúo', value: player.victories.duo },
  ];
  return (
    <section aria-label="Estadísticas">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-wider text-muted">TROFEOS</p>
          <AnimatedNumber value={player.trophies} className="font-display text-3xl text-primary" />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold tracking-wider text-muted">MÁXIMO</p>
          <p className="font-display text-xl tabular-nums">{formatNumber(player.highestTrophies)}</p>
        </div>
      </Card>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{s.label}</dt>
            <dd className="font-display text-lg tabular-nums">{formatNumber(s.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-muted">{player.brawlers.length} brawlers desbloqueados</p>
    </section>
  );
}
