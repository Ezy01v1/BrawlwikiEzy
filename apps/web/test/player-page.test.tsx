import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvalidTag } from '@/components/player/InvalidTag';
import { PlayerOverview } from '@/components/player/PlayerOverview';
import { playerTabs, resolveTag } from '@/lib/player-route';
import { PLAYER } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('ruta del jugador', () => {
  it('resolveTag normaliza lo que llega por URL y rechaza lo inválido', () => {
    expect(resolveTag('2PP')).toBe('2PP');
    expect(resolveTag('2pp')).toBe('2PP');
    expect(resolveTag('%232PP')).toBe('2PP');
    expect(resolveTag('#2PO')).toBe('2P0');
    expect(resolveTag('HOLA')).toBeNull();
    expect(resolveTag('%E0%A4%A')).toBeNull();
  });

  it('playerTabs arma los links de los tabs y marca el activo', () => {
    expect(playerTabs('2PP', 'partidas')).toEqual([
      { href: '/jugador/2PP', label: 'Resumen', active: false },
      { href: '/jugador/2PP?tab=brawlers', label: 'Brawlers', active: false },
      { href: '/jugador/2PP?tab=partidas', label: 'Partidas', active: true },
    ]);
  });
});

describe('PlayerOverview e InvalidTag', () => {
  it('resumen con los 3 brawlers de más trofeos y links a los tabs', () => {
    render(<PlayerOverview player={PLAYER} />);
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')?.split(',')[0]);
    expect(names).toEqual(['Bull', 'Shelly', 'Colt']);
    expect(screen.getByRole('link', { name: 'Ver los 4 brawlers' })).toHaveAttribute('href', '/jugador/2PP?tab=brawlers');
    expect(screen.getByRole('link', { name: 'Ver partidas recientes' })).toHaveAttribute(
      'href',
      '/jugador/2PP?tab=partidas',
    );
  });

  it('jugador sin brawlers → estado vacío', () => {
    render(<PlayerOverview player={{ ...PLAYER, brawlers: [] }} />);
    expect(screen.getByText('Todavía no tiene brawlers')).toBeInTheDocument();
  });

  it('InvalidTag explica los caracteres válidos y ofrece buscar de nuevo', () => {
    render(<InvalidTag />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeInTheDocument();
    expect(screen.getByText('0289PYLQGRJCUV')).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});
