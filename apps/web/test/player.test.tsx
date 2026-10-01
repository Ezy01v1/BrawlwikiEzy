import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrawlerGrid } from '@/components/brawler/BrawlerGrid';
import { BrawlerTile, tileBackground } from '@/components/brawler/BrawlerTile';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerStats } from '@/components/player/PlayerStats';
import { parseOrder, sortBrawlers } from '@/lib/brawlers';
import { first, parseTab } from '@/lib/search-params';
import { brawler, PLAYER } from './fixtures';

describe('orden y parámetros', () => {
  it('sortBrawlers por trofeos, poder y nombre sin mutar', () => {
    const list = [
      brawler({ name: 'COLT', trophies: 750, power: 11 }),
      brawler({ name: 'BULL', trophies: 1000, power: 9 }),
      brawler({ name: 'ASH', trophies: 750, power: 11 }),
    ];
    expect(sortBrawlers(list, 'trofeos').map((b) => b.name)).toEqual(['BULL', 'ASH', 'COLT']);
    expect(sortBrawlers(list, 'poder').map((b) => b.name)).toEqual(['ASH', 'COLT', 'BULL']);
    expect(sortBrawlers(list, 'nombre').map((b) => b.name)).toEqual(['ASH', 'BULL', 'COLT']);
    expect(list[0]!.name).toBe('COLT');
  });

  it('parseOrder, parseTab y first con valores por defecto', () => {
    expect(parseOrder(undefined)).toBe('trofeos');
    expect(parseOrder('poder')).toBe('poder');
    expect(parseOrder('hack')).toBe('trofeos');
    expect(parseTab('partidas')).toBe('partidas');
    expect(parseTab('x')).toBe('resumen');
    expect(first(['a', 'b'])).toBe('a');
    expect(first(undefined)).toBeUndefined();
  });
});

describe('BrawlerTile y BrawlerGrid', () => {
  it('tile con nombre en formato título, rareza en el aria-label y fondo neutro sin rareza', () => {
    render(<BrawlerTile brawler={PLAYER.brawlers[0]!} />);
    expect(screen.getByRole('article', { name: 'Bull, 1,000 trofeos, poder 11, Rare' })).toBeInTheDocument();
    expect(screen.getByText('Bull')).toBeInTheDocument();
    expect(tileBackground(null)).toContain('#3a3a4a');
    expect(tileBackground('#68fd58')).toContain('#68fd58');
  });

  it('grid ordenada con links de orden', () => {
    render(<BrawlerGrid brawlers={PLAYER.brawlers} order="nombre" basePath="/jugador/2PP?tab=brawlers" />);
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')?.split(',')[0]);
    expect(names).toEqual(['Brock', 'Bull', 'Colt', 'Shelly']);
    const nav = screen.getByRole('navigation', { name: 'Ordenar brawlers' });
    expect(within(nav).getByRole('link', { name: 'Nombre' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('link', { name: 'Poder' })).toHaveAttribute('href', '/jugador/2PP?tab=brawlers&orden=poder');
  });
});

describe('PlayerHeader y PlayerStats', () => {
  it('header con nombre truncable, tag, nivel y club', () => {
    render(<PlayerHeader player={PLAYER} />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'EzyPlayer' });
    expect(h1).toHaveClass('truncate');
    expect(screen.getByText(/#2PP · Nivel 187/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
  });

  it('header sin club', () => {
    render(<PlayerHeader player={{ ...PLAYER, club: null }} />);
    expect(screen.getByText(/Sin club/)).toBeInTheDocument();
  });

  it('stats formateadas', () => {
    render(<PlayerStats player={PLAYER} />);
    expect(screen.getByText('42,310', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('43,002')).toBeInTheDocument();
    expect(screen.getByText('3,412')).toBeInTheDocument();
    expect(screen.getByText('4 brawlers desbloqueados')).toBeInTheDocument();
  });
});
