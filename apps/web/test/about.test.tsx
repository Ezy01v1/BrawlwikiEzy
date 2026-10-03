import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from '@/app/acerca/page';
import { Footer } from '@/components/layout/Footer';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

describe('Acerca de', () => {
  it('explica los datos, la privacidad y el aviso legal con la Fan Content Policy', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acerca de BrawlWiki' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'De dónde salen los datos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aviso legal' })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fan Content Policy de Supercell' })).toHaveAttribute(
      'href',
      'https://supercell.com/en/fan-content-policy/',
    );
  });

  it('el footer enlaza a la página Acerca de', () => {
    render(<Footer />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acerca de BrawlWiki' })).toHaveAttribute('href', '/acerca');
  });
});
