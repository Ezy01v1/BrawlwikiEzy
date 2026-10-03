import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClubHeader } from '@/components/club/ClubHeader';
import { ClubMemberList } from '@/components/club/ClubMemberList';
import { ClubStats } from '@/components/club/ClubStats';
import { clubTypeLabel, roleLabel, summarizeClub } from '@/lib/clubs';
import { CLUB, CLUB_B } from './fixtures';

describe('clubs', () => {
  it('traduce roles y tipos, y deja tal cual lo desconocido', () => {
    expect(roleLabel('president')).toBe('Presidente');
    expect(roleLabel('vicePresident')).toBe('Vicepresidente');
    expect(roleLabel('senior')).toBe('Veterano');
    expect(roleLabel('newRole')).toBe('newRole');
    expect(clubTypeLabel('inviteOnly')).toBe('Solo por invitación');
    expect(clubTypeLabel('unknown')).toBe('unknown');
  });

  it('summarizeClub: miembros, promedio y mejor; un club vacío da 0 y no NaN', () => {
    expect(summarizeClub(CLUB)).toEqual({ members: 3, average: 27870, best: 42310 });
    expect(summarizeClub({ ...CLUB, members: [] })).toEqual({ members: 0, average: 0, best: 0 });
  });
});

describe('componentes de club', () => {
  it('ClubHeader: nombre truncable, tag, tipo y favorito de club', () => {
    render(<ClubHeader club={CLUB} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Los Cracks' })).toHaveClass('truncate');
    expect(screen.getByText('#2YPLQ · Solo por invitación')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Escudo de Los Cracks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
  });

  it('ClubStats: trofeos, miembros sobre 30, promedio, requeridos y descripción solo si existe', () => {
    const { unmount } = render(<ClubStats club={CLUB} />);
    expect(screen.getByText('83,610', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('3/30')).toBeInTheDocument();
    expect(screen.getByText('27,870')).toBeInTheDocument();
    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByText('Club de prueba. ¡Activos diario!')).toBeInTheDocument();
    unmount();
    const { container } = render(<ClubStats club={CLUB_B} />);
    expect(container.querySelector('[data-club-description]')).toBeNull();
  });

  it('ClubMemberList: orden, link al perfil, rol en texto y trofeos', () => {
    render(<ClubMemberList members={CLUB.members} />);
    expect(screen.getByRole('heading', { name: 'Miembros (3)' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByRole('link', { name: 'EzyPlayer' })).toHaveAttribute('href', '/jugador/2PP');
    expect(within(items[0]!).getByText('Presidente')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Vicepresidente')).toBeInTheDocument();
    expect(within(items[2]!).getByText('1,200')).toBeInTheDocument();
  });

  it('ClubMemberList vacío → estado vacío', () => {
    render(<ClubMemberList members={[]} />);
    expect(screen.getByText('Este club no tiene miembros')).toBeInTheDocument();
  });
});
