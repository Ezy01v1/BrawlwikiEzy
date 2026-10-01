'use client';

import type { Battle, BattlePlayer } from '@brawlwiki/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { GameImage } from '@/components/ui/GameImage';
import { battleOutcome, findPlayer } from '@/lib/battles';
import { displayName, signed, timeAgo } from '@/lib/format';
import { modeName } from '@/lib/modes';

/** El mapper manda { id: 0, name: '?', imageUrl: null } cuando Supercell no trae el brawler. */
function brawlerName(p: BattlePlayer): string {
  return p.brawler.id === 0 ? 'Brawler desconocido' : displayName(p.brawler.name);
}

function BrawlerIcon({ player, size }: { player: BattlePlayer; size: number }) {
  return (
    <GameImage
      src={player.brawler.imageUrl}
      alt={brawlerName(player)}
      size={size}
      fallbackText={player.brawler.id === 0 ? '?' : displayName(player.brawler.name)}
      className="rounded-chip bg-surface-2"
    />
  );
}

function duration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function teamTitle(team: BattlePlayer[], index: number, total: number, playerTag: string): string {
  if (total === 2) return team.some((p) => p.tag === playerTag) ? 'Equipo del jugador' : 'Rivales';
  return `Equipo ${index + 1}`;
}

interface TeamProps {
  title: string;
  players: BattlePlayer[];
  playerTag: string;
  starTag: string | null;
}

function Team({ title, players, playerTag, starTag }: TeamProps) {
  return (
    <div className="mt-2 first:mt-0">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <ul>
        {players.map((p, i) => (
          <li key={`${p.tag}-${i}`} className="flex min-h-11 items-center gap-2">
            <BrawlerIcon player={p} size={32} />
            <span className="min-w-0 flex-1">
              {p.tag === playerTag ? (
                <span className="block truncate text-sm font-semibold">{p.name}</span>
              ) : (
                <Link
                  href={`/jugador/${p.tag}`}
                  className="block truncate text-sm font-semibold underline-offset-2 hover:underline"
                >
                  {p.name}
                </Link>
              )}
              <span className="block truncate text-xs text-muted">
                {brawlerName(p)}
                {p.brawler.id !== 0 && ` · P${p.brawler.power}`}
              </span>
            </span>
            {p.tag === starTag && (
              <Chip tone="accent">
                <span aria-hidden="true">⭐ </span>
                Estelar
              </Chip>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BattleRow({ battle, playerTag, now }: { battle: Battle; playerTag: string; now: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const outcome = battleOutcome(battle);
  const self = findPlayer(battle, playerTag);
  const map = battle.map.name ?? 'Mapa desconocido';
  const solo = battle.teams.every((t) => t.length <= 1);
  const change = battle.trophyChange;

  return (
    <div className="rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-3 rounded-card p-2 text-left hover:bg-surface-2"
      >
        {self && <BrawlerIcon player={self} size={40} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{modeName(battle.mode)}</span>
          <span className="block truncate text-xs text-muted">
            {map} · {timeAgo(battle.battleTime, now)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Chip tone={outcome.tone}>{outcome.label}</Chip>
          {change !== null && (
            <span
              className={`text-xs font-bold tabular-nums ${change > 0 ? 'text-win' : change < 0 ? 'text-loss' : 'text-muted'}`}
            >
              {signed(change)}
              <span aria-hidden="true"> 🏆</span>
              <span className="sr-only"> trofeos</span>
            </span>
          )}
        </span>
        <span aria-hidden="true" className={`text-xs text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-border p-2">
        {solo ? (
          <Team title="Jugadores" players={battle.teams.flat()} playerTag={playerTag} starTag={battle.starPlayerTag} />
        ) : (
          battle.teams.map((team, i) => (
            <Team
              key={i}
              title={teamTitle(team, i, battle.teams.length, playerTag)}
              players={team}
              playerTag={playerTag}
              starTag={battle.starPlayerTag}
            />
          ))
        )}
        {battle.durationSeconds !== null && (
          <p className="mt-2 text-xs text-muted">Duración: {duration(battle.durationSeconds)}</p>
        )}
      </div>
    </div>
  );
}
