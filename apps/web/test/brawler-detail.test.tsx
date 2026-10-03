import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrawlerNotFound from '@/app/brawlers/[id]/not-found';
import { BrawlerDetail } from '@/components/brawler/BrawlerDetail';
import { CATALOG } from './fixtures';

describe('detalle de brawler', () => {
  it('sin metadatos: "Sin dato", gadgets y habilidades estelares en formato título', () => {
    render(<BrawlerDetail brawler={CATALOG[0]!} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Shelly' })).toBeInTheDocument();
    expect(screen.getAllByText('Sin dato')).toHaveLength(2);
    const gadgets = screen.getByRole('region', { name: 'Gadgets' });
    expect(within(gadgets).getByText('Fast Forward')).toBeInTheDocument();
    const stars = screen.getByRole('region', { name: 'Habilidades estelares' });
    expect(within(stars).getByText('Shell Shock')).toBeInTheDocument();
  });

  it('con metadatos: rareza y clase en español; lista vacía explicada', () => {
    render(<BrawlerDetail brawler={CATALOG[2]!} />);
    expect(screen.getByText('Raro')).toBeInTheDocument();
    expect(screen.getByText('Tanque')).toBeInTheDocument();
    expect(screen.getByText('T-Bone Injector')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tiene habilidades estelares.')).toBeInTheDocument();
  });

  it('404 del brawler con link al catálogo', () => {
    render(<BrawlerNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos los brawlers' })).toHaveAttribute('href', '/brawlers');
  });
});
