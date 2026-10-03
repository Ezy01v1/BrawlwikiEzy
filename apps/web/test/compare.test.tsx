import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClubCompare } from '@/components/club/ClubCompare';
import { CompareForm } from '@/components/club/CompareForm';
import { COMPARE_INVALID, compareClubs, parseCompareParams } from '@/lib/clubs';
import { CLUB, CLUB_B } from './fixtures';

describe('compareClubs', () => {
  it('compara cinco métricas y marca el lado mayor', () => {
    expect(compareClubs(CLUB, CLUB_B)).toEqual([
      { label: 'Trofeos totales', a: 83610, b: 83000, winner: 'a' },
      { label: 'Miembros', a: 3, b: 2, winner: 'a' },
      { label: 'Promedio por miembro', a: 27870, b: 41500, winner: 'b' },
      { label: 'Mejor jugador', a: 42310, b: 45000, winner: 'b' },
      { label: 'Trofeos requeridos', a: 25000, b: 30000, winner: 'b' },
    ]);
  });

  it('empates sin ganador y club vacío sin NaN', () => {
    expect(compareClubs(CLUB, CLUB).every((m) => m.winner === null)).toBe(true);
    const empty = { ...CLUB_B, members: [] };
    const metrics = compareClubs(CLUB, empty);
    expect(metrics.find((m) => m.label === 'Promedio por miembro')).toEqual({
      label: 'Promedio por miembro',
      a: 27870,
      b: 0,
      winner: 'a',
    });
    expect(metrics.some((m) => Number.isNaN(m.a) || Number.isNaN(m.b))).toBe(false);
  });
});

describe('parseCompareParams', () => {
  it('normaliza, valida cada campo y rechaza el mismo club dos veces', () => {
    expect(parseCompareParams()).toEqual({ a: null, b: null, rawA: '', rawB: '', errors: {} });
    expect(parseCompareParams(' #2yplq ', '8cgrv')).toEqual({
      a: '2YPLQ',
      b: '8CGRV',
      rawA: ' #2yplq ',
      rawB: '8cgrv',
      errors: {},
    });
    expect(parseCompareParams('hola', '').errors).toEqual({ a: COMPARE_INVALID });
    expect(parseCompareParams('2YPLQ', '#2yplq').errors).toEqual({ b: 'Elige un club distinto al Club A.' });
  });
});

describe('componentes del comparador', () => {
  it('ClubCompare: una tarjeta por métrica, valores visibles y "Mayor" en texto', () => {
    render(<ClubCompare a={CLUB} b={CLUB_B} />);
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.getByRole('link', { name: 'Titanes' })).toHaveAttribute('href', '/club/8CGRV');
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    const first = within(cards[0]!);
    expect(first.getByRole('heading', { name: 'Trofeos totales' })).toBeInTheDocument();
    expect(first.getByText('83,610')).toBeInTheDocument();
    expect(first.getByText('83,000')).toBeInTheDocument();
    expect(first.getAllByText('Mayor')).toHaveLength(1);
  });

  it('CompareForm: GET nativo, valores previos y error en línea por campo', () => {
    const { container } = render(<CompareForm a="hola" b="8CGRV" errors={{ a: COMPARE_INVALID }} />);
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/clubes/comparar');
    expect(screen.getByLabelText('Club A')).toHaveValue('hola');
    expect(screen.getByLabelText('Club A')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Club B')).toHaveValue('8CGRV');
    expect(screen.getByLabelText('Club B')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('0289PYLQGRJCUV');
    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveAttribute('type', 'submit');
  });
});
