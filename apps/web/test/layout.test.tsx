import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { isActive, NavLinks } from '@/components/layout/NavLinks';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ enabled: false, user: null }) }));

describe('navegación', () => {
  it('isActive', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/jugador/2PP', '/')).toBe(false);
    expect(isActive('/rankings', '/rankings')).toBe(true);
    expect(isActive('/brawlers/16000000', '/brawlers')).toBe(true);
    expect(isActive('/club/2YPLQ', '/clubes/comparar')).toBe(true);
    expect(isActive('/rankingsx', '/rankings')).toBe(false);
    expect(isActive('/clubes/comparar', '/clubes/comparar')).toBe(true);
    expect(isActive('/clubesx', '/clubes/comparar')).toBe(false);
    expect(isActive('/tierlist/editar', '/tierlist')).toBe(true);
  });

  it('NavLinks inferior marca el link activo; Tier list reemplaza a Clubes y siguen siendo 4', () => {
    pathname = '/rankings';
    render(<NavLinks variant="bottom" />);
    const nav = screen.getByRole('navigation', { name: 'Navegación inferior' });
    expect(within(nav).getByRole('link', { name: /Rankings/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Inicio/ })).not.toHaveAttribute('aria-current');
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByRole('link', { name: /Tier list/ })).toHaveAttribute('href', '/tierlist');
    expect(within(nav).queryByRole('link', { name: /Clubes/ })).not.toBeInTheDocument();
  });
});

describe('Header y Footer', () => {
  it('Header tiene logo al inicio, búsqueda y cambio de tema; Footer muestra el disclaimer', async () => {
    pathname = '/';
    render(
      <>
        {await Header({})}
        <Footer />
      </>,
    );
    expect(screen.getByRole('link', { name: 'BrawlWiki, inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
