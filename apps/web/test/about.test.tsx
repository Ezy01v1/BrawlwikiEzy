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

  it('la sección Cuentas dice qué se guarda, qué no y que borrar la cuenta lo elimina todo', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeInTheDocument();
    expect(screen.getByText(/tu id, tu nombre y tu avatar de Discord, el tag que vincules, tus favoritos y tus votos/)).toBeInTheDocument();
    expect(screen.getByText(/No guardamos tu email ni el token de Discord/)).toBeInTheDocument();
    expect(screen.getByText('bw_session')).toBeInTheDocument();
    expect(screen.getByText(/vence tras 30 días sin entrar al sitio/)).toBeInTheDocument();
    expect(screen.getByText(/solo muestra resultados agregados/)).toBeInTheDocument();
    expect(screen.getByText(/se elimina todo lo que guardamos de ella/)).toBeInTheDocument();
  });

  it('el footer enlaza a la página Acerca de', () => {
    render(<Footer />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acerca de BrawlWiki' })).toHaveAttribute('href', '/acerca');
  });
});
