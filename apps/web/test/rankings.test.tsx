import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeaderboardList } from '@/components/rankings/LeaderboardList';
import { RankBadge } from '@/components/rankings/RankBadge';
import { RankingFilters } from '@/components/rankings/RankingFilters';
import {
  parseRankingType,
  parseRegion,
  rankingSubtitle,
  rankingsHref,
  rankingTabs,
  regionLabel,
  regionOptions,
} from '@/lib/rankings';
import { RANKED_CLUBS, RANKED_PLAYERS } from './fixtures';

describe('lib/rankings', () => {
  it('parsea tipo y región con valores por defecto seguros', () => {
    expect(parseRankingType(undefined)).toBe('jugadores');
    expect(parseRankingType('clubes')).toBe('clubes');
    expect(parseRankingType('hack')).toBe('jugadores');
    expect(parseRegion(undefined)).toBe('global');
    expect(parseRegion('GLOBAL')).toBe('global');
    expect(parseRegion('mx')).toBe('MX');
    expect(parseRegion('zz')).toBe('ZZ');
    expect(parseRegion('mex')).toBe('global');
  });

  it('nombres de región en español; las opciones incluyen la región actual', () => {
    expect(regionLabel('global')).toBe('Global');
    expect(regionLabel('MX')).toBe('México');
    const options = regionOptions('global');
    expect(options[0]).toEqual({ value: 'global', label: 'Global' });
    expect(options).toContainEqual({ value: 'MX', label: 'México' });
    expect(options.some((o) => o.value === 'ZZ')).toBe(false);
    expect(regionOptions('ZZ').some((o) => o.value === 'ZZ')).toBe(true);
    expect(rankingSubtitle('global')).toBe('Top 50 · Global');
    expect(rankingSubtitle('MX', 'Shelly')).toBe('Top 50 · México · Shelly');
  });

  it('rankingsHref y rankingTabs conservan la región y solo llevan brawler en su tipo', () => {
    expect(rankingsHref({ tipo: 'jugadores', region: 'global', brawler: null })).toBe('/rankings?tipo=jugadores');
    expect(rankingsHref({ tipo: 'brawler', region: 'MX', brawler: 16000001 })).toBe(
      '/rankings?tipo=brawler&region=MX&brawler=16000001',
    );
    expect(rankingsHref({ tipo: 'clubes', region: 'ES', brawler: 16000001 })).toBe('/rankings?tipo=clubes&region=ES');
    expect(rankingTabs({ tipo: 'clubes', region: 'MX', brawler: null })).toEqual([
      { href: '/rankings?tipo=jugadores&region=MX', label: 'Jugadores', active: false },
      { href: '/rankings?tipo=clubes&region=MX', label: 'Clubes', active: true },
      { href: '/rankings?tipo=brawler&region=MX', label: 'Por brawler', active: false },
    ]);
  });
});

describe('componentes de rankings', () => {
  it('RankBadge anuncia el puesto en texto', () => {
    const { container } = render(<RankBadge rank={2} />);
    expect(container).toHaveTextContent('Puesto 2');
  });

  it('LeaderboardList de jugadores: link al perfil, club o "Sin club" y trofeos', () => {
    render(<LeaderboardList kind="players" items={RANKED_PLAYERS} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
    expect(within(rows[0]!).getByText('Tribe')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('98,410')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Sin club')).toBeInTheDocument();
  });

  it('LeaderboardList de clubes: link al club y cantidad de miembros', () => {
    render(<LeaderboardList kind="clubs" items={RANKED_CLUBS} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(within(rows[0]!).getByText('30 miembros')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('1,020,000')).toBeInTheDocument();
  });

  it('RankingFilters: GET nativo, región elegida y selector de brawler solo en su tipo', () => {
    const brawlers = [
      { id: 16000002, name: 'BULL' },
      { id: 16000000, name: 'SHELLY' },
    ];
    const { container, unmount } = render(
      <RankingFilters tipo="jugadores" region="MX" brawler={null} brawlers={brawlers} />,
    );
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/rankings');
    expect(container.querySelector('input[type="hidden"][name="tipo"]')).toHaveValue('jugadores');
    expect(screen.getByLabelText('Región')).toHaveValue('MX');
    expect(screen.queryByLabelText('Brawler')).not.toBeInTheDocument();
    unmount();
    render(<RankingFilters tipo="brawler" region="global" brawler={16000002} brawlers={brawlers} />);
    expect(screen.getByLabelText('Brawler')).toHaveValue('16000002');
    expect(screen.getByRole('option', { name: 'Bull' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver ranking' })).toHaveAttribute('type', 'submit');
  });
});
