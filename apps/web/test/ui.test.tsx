import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DISCLAIMER, Disclaimer } from '@/components/ui/Disclaimer';
import { GameImage, initials } from '@/components/ui/GameImage';
import { Tabs } from '@/components/ui/Tabs';

describe('Button', () => {
  it('es type=button por defecto y ButtonLink es un enlace', () => {
    render(
      <>
        <Button>Buscar</Button>
        <ButtonLink href="/rankings">Rankings</ButtonLink>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('link', { name: 'Rankings' })).toHaveAttribute('href', '/rankings');
  });
});

describe('GameImage', () => {
  it('muestra la imagen y cae al fallback con iniciales si falla la carga', () => {
    render(<GameImage src="https://cdn.brawlify.com/brawlers/borderless/1.png" alt="Shelly" size={64} />);
    fireEvent.error(screen.getByRole('img', { name: 'Shelly' }));
    const fallback = screen.getByRole('img', { name: 'Shelly' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveTextContent('S');
  });

  it('src null → fallback directo con fallbackText', () => {
    render(<GameImage src={null} alt="Badge del club" size={48} fallbackText="Los Cracks" />);
    expect(screen.getByRole('img', { name: 'Badge del club' })).toHaveTextContent('LC');
  });

  it('initials', () => {
    expect(initials('EzyPlayer')).toBe('E');
    expect(initials('mr p')).toBe('MP');
    expect(initials('🍁')).toBe('?');
  });
});

describe('AnimatedNumber', () => {
  it('con reduced motion muestra el valor final y siempre lo expone en texto sr-only', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { container } = render(<AnimatedNumber value={42310} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('42,310');
    expect(screen.getByText('42,310', { selector: '.sr-only' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('Tabs y Disclaimer', () => {
  it('marca solo el tab activo con aria-current', () => {
    render(
      <Tabs
        label="Secciones"
        items={[
          { href: '/a', label: 'Resumen', active: false },
          { href: '/a?tab=b', label: 'Brawlers', active: true },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Brawlers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Resumen' })).not.toHaveAttribute('aria-current');
  });

  it('Disclaimer usa el texto exacto', () => {
    render(<Disclaimer />);
    expect(DISCLAIMER).toBe('Este material es no oficial y no está avalado por Supercell.');
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
