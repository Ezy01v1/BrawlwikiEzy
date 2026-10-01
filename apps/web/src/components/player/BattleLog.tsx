import type { Battle } from '@brawlwiki/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { summarizeBattles } from '@/lib/battles';
import { signed } from '@/lib/format';
import { BattleRow } from './BattleRow';

export function BattleLog({ battles, playerTag, now }: { battles: Battle[]; playerTag: string; now: number }) {
  if (battles.length === 0) {
    return (
      <EmptyState title="Sin partidas recientes">
        Supercell solo muestra las últimas 25 partidas. Si el jugador no ha jugado en un tiempo, la lista queda vacía.
      </EmptyState>
    );
  }

  const s = summarizeBattles(battles);
  const deltaTone = s.trophyDelta > 0 ? 'text-win' : s.trophyDelta < 0 ? 'text-loss' : '';
  const stats = [
    { label: '% de victorias', value: s.winRate === null ? '—' : `${s.winRate}%`, tone: '' },
    { label: 'Victorias', value: String(s.wins), tone: '' },
    { label: 'Trofeos', value: signed(s.trophyDelta), tone: deltaTone },
  ];

  return (
    <section aria-labelledby="partidas-title">
      <h2 id="partidas-title" className="font-display text-lg">
        Últimas {s.total} partidas
      </h2>
      <dl className="my-2 grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <div key={st.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{st.label}</dt>
            <dd className={`font-display text-lg tabular-nums ${st.tone}`}>{st.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-2">
        {battles.map((b, i) => (
          <li key={`${b.battleTime}-${i}`}>
            <BattleRow battle={b} playerTag={playerTag} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
