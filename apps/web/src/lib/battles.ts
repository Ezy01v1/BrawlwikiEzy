import type { Battle, BattlePlayer } from '@brawlwiki/shared';

export type OutcomeTone = 'win' | 'loss' | 'neutral';

export interface Outcome {
  label: string;
  tone: OutcomeTone;
}

export function battleOutcome(b: Battle): Outcome {
  if (b.result === 'victory') return { label: 'Victoria', tone: 'win' };
  if (b.result === 'defeat') return { label: 'Derrota', tone: 'loss' };
  if (b.result === 'draw') return { label: 'Empate', tone: 'neutral' };
  if (b.rank !== null) {
    const change = b.trophyChange ?? 0;
    return { label: `Puesto ${b.rank}`, tone: change > 0 ? 'win' : change < 0 ? 'loss' : 'neutral' };
  }
  return { label: 'Sin resultado', tone: 'neutral' };
}

export interface BattleSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  /** Porcentaje entero sobre las partidas con resultado; `null` si no hay ninguna. */
  winRate: number | null;
  trophyDelta: number;
}

export function summarizeBattles(battles: Battle[]): BattleSummary {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let trophyDelta = 0;
  for (const b of battles) {
    if (b.result === 'victory') wins++;
    else if (b.result === 'defeat') losses++;
    else if (b.result === 'draw') draws++;
    trophyDelta += b.trophyChange ?? 0;
  }
  const decided = wins + losses + draws;
  return {
    total: battles.length,
    wins,
    losses,
    draws,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : null,
    trophyDelta,
  };
}

export function findPlayer(b: Battle, tag: string): BattlePlayer | null {
  for (const team of b.teams) {
    for (const p of team) if (p.tag === tag) return p;
  }
  return null;
}
