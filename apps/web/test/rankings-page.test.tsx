import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingSection } from '@/components/rankings/RankingSection';
import { ApiError } from '@/lib/api';
import { sortByDisplayName } from '@/lib/brawlers';
import { RANKED_CLUBS } from './fixtures';

const getPlayerRankings = vi.fn();
const getClubRankings = vi.fn();
const getBrawlerRankings = vi.fn();
vi.mock('@/lib/queries', () => ({
  getPlayerRankings: (...a: unknown[]) => getPlayerRankings(...a),
  getClubRankings: (...a: unknown[]) => getClubRankings(...a),
  getBrawlerRankings: (...a: unknown[]) => getBrawlerRankings(...a),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const META = { source: 'fresh' as const, fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 0 };

beforeEach(() => {
  getPlayerRankings.mockReset();
  getClubRankings.mockReset();
  getBrawlerRankings.mockReset();
});

describe('rankings', () => {
  it('sortByDisplayName ordena por el nombre que se muestra, sin mutar', () => {
    const list = [{ name: 'SHELLY' }, { name: 'EL PRIMO' }, { name: '8-BIT' }];
    expect(sortByDisplayName(list).map((b) => b.name)).toEqual(['8-BIT', 'EL PRIMO', 'SHELLY']);
    expect(list[0]!.name).toBe('SHELLY');
  });

  it('región sin datos → estado vacío (Supercell responde 200 con [])', async () => {
    getPlayerRankings.mockResolvedValue({ data: [], meta: META });
    render(await RankingSection({ tipo: 'jugadores', region: 'ZZ', brawler: null }));
    expect(getPlayerRankings).toHaveBeenCalledWith('ZZ');
    expect(screen.getByText('No hay ranking para esta región')).toBeInTheDocument();
  });

  it('clubes y por brawler llaman a su query; un error se muestra en línea', async () => {
    getClubRankings.mockResolvedValue({ data: RANKED_CLUBS, meta: META });
    const { unmount } = render(await RankingSection({ tipo: 'clubes', region: 'global', brawler: null }));
    expect(getClubRankings).toHaveBeenCalledWith('global');
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    unmount();
    getBrawlerRankings.mockRejectedValue(new ApiError('INVALID_PARAM', 'Id de brawler inválido.', { status: 400 }));
    render(await RankingSection({ tipo: 'brawler', region: 'MX', brawler: 16000001 }));
    expect(getBrawlerRankings).toHaveBeenCalledWith(16000001, 'MX');
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los filtros');
  });
});
