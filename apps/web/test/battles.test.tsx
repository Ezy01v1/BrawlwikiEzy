import type { Battle } from '@brawlwiki/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BattleLog } from '@/components/player/BattleLog';
import { BattleRow } from '@/components/player/BattleRow';
import { battleOutcome, findPlayer, summarizeBattles } from '@/lib/battles';
import { BATTLES } from './fixtures';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const [gem, ball, showdown, duel] = BATTLES as [Battle, Battle, Battle, Battle];

describe('battles', () => {
  it('battleOutcome comunica el resultado con texto', () => {
    expect(battleOutcome(gem)).toEqual({ label: 'Victoria', tone: 'win' });
    expect(battleOutcome(ball)).toEqual({ label: 'Derrota', tone: 'loss' });
    expect(battleOutcome({ ...gem, result: 'draw' })).toEqual({ label: 'Empate', tone: 'neutral' });
    expect(battleOutcome(showdown)).toEqual({ label: 'Puesto 2', tone: 'win' });
    expect(battleOutcome({ ...showdown, rank: 7, trophyChange: -4 })).toEqual({ label: 'Puesto 7', tone: 'loss' });
    expect(battleOutcome({ ...gem, result: null })).toEqual({ label: 'Sin resultado', tone: 'neutral' });
  });

  it('summarizeBattles cuenta solo partidas con resultado y suma los trofeos', () => {
    expect(summarizeBattles(BATTLES)).toEqual({ total: 4, wins: 2, losses: 1, draws: 0, winRate: 67, trophyDelta: 11 });
    expect(findPlayer(gem, '8QU')?.name).toBe('SinClub');
    expect(findPlayer(gem, '9999')).toBeNull();
  });

  it('summarizeBattles([]) no produce NaN', () => {
    expect(summarizeBattles([])).toEqual({ total: 0, wins: 0, losses: 0, draws: 0, winRate: null, trophyDelta: 0 });
  });
});

describe('BattleRow', () => {
  it('cerrada: modo, mapa, hace cuánto, resultado en texto y trofeos', () => {
    render(<BattleRow battle={gem} playerTag="2PP" now={NOW} />);
    const button = screen.getByRole('button', { name: /Atrapagemas/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Hard Rock Mine · hace 5 min');
    expect(button).toHaveTextContent('Victoria');
    expect(button).toHaveTextContent('+8');
    expect(screen.queryByRole('link', { name: 'SinClub' })).not.toBeInTheDocument();
  });

  it('se expande con el teclado y muestra equipos, links y jugador estelar', async () => {
    const user = userEvent.setup();
    render(<BattleRow battle={gem} playerTag="2PP" now={NOW} />);
    await user.tab();
    const button = screen.getByRole('button', { name: /Atrapagemas/ });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Equipo del jugador' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rivales' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SinClub' })).toHaveAttribute('href', '/jugador/8QU');
    expect(screen.queryByRole('link', { name: 'EzyPlayer' })).not.toBeInTheDocument();
    expect(screen.getByText('Estelar')).toBeInTheDocument();
    expect(screen.getByText('Duración: 2:01')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('tolera el brawler centinela del mapper (id 0, "?", sin imagen)', async () => {
    const unknown = { tag: '2PP', name: 'EzyPlayer', brawler: { id: 0, name: '?', power: 0, trophies: 0, imageUrl: null } };
    render(<BattleRow battle={{ ...duel, teams: [[unknown]] }} playerTag="2PP" now={NOW} />);
    const button = screen.getByRole('button', { name: /Duelos/ });
    expect(button).toHaveTextContent('Mapa desconocido');
    await userEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Jugadores' })).toBeInTheDocument();
    const images = screen.getAllByRole('img', { name: 'Brawler desconocido' });
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img).toHaveTextContent('?');
  });
});

describe('BattleLog', () => {
  it('vacío → EmptyState, sin porcentajes ni NaN', () => {
    const { container } = render(<BattleLog battles={[]} playerTag="2PP" now={NOW} />);
    expect(screen.getByText('Sin partidas recientes')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('NaN');
    expect(container).not.toHaveTextContent('%');
  });

  it('con partidas → resumen y una fila expandible por partida', () => {
    render(<BattleLog battles={BATTLES} playerTag="2PP" now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Últimas 4 partidas' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('+11')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(4);
  });
});
