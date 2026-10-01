import type { EventSlot } from '@brawlwiki/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventCard } from '@/components/events/EventCard';
import { modeName } from '@/lib/modes';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const slot: EventSlot = {
  slotId: 1,
  startTime: '2026-09-29T08:00:00.000Z',
  endTime: '2026-09-29T15:00:00.000Z',
  mode: { name: 'gemGrab', imageUrl: null },
  map: { id: 15000026, name: 'Hard Rock Mine', imageUrl: 'https://cdn.brawlify.com/maps/regular/15000026.png' },
};

describe('modos', () => {
  it('traduce modos conocidos y formatea los desconocidos', () => {
    expect(modeName('gemGrab')).toBe('Atrapagemas');
    expect(modeName('brawlBall')).toBe('Balón Brawl');
    expect(modeName('newMode')).toBe('New Mode');
  });
});

describe('EventCard', () => {
  it('muestra modo, mapa, imagen y tiempo restante', () => {
    render(<EventCard slot={slot} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Atrapagemas' })).toBeInTheDocument();
    expect(screen.getByText('Hard Rock Mine')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa Hard Rock Mine' })).toBeInTheDocument();
    expect(screen.getByText('Termina en 3 h')).toBeInTheDocument();
  });

  it('evento vencido → "Terminado"; mapa sin nombre → "Mapa desconocido"', () => {
    render(
      <EventCard
        slot={{ ...slot, endTime: '2026-09-29T11:00:00.000Z', map: { id: null, name: null, imageUrl: null } }}
        now={NOW}
      />,
    );
    expect(screen.getByText('Terminado')).toBeInTheDocument();
    expect(screen.getByText('Mapa desconocido')).toBeInTheDocument();
  });
});
