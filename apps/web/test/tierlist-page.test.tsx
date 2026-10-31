import type { CommunityTierList, Season, TierRow } from '@brawlwiki/shared';
import { render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TierListPage from '@/app/tierlist/page';
import { ApiError } from '@/lib/api';
import { CATALOG } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// Marca los <Link> de Next: el login no puede ser uno (el prefetch arrancaría el OAuth).
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) =>
    createElement('a', { href, 'data-next-link': '', ...rest }, children),
}));

const getCommunityTierList = vi.fn();
const getSeasons = vi.fn();
const getBrawlers = vi.fn();
vi.mock('@/lib/queries', () => ({
  getCommunityTierList: (...a: unknown[]) => getCommunityTierList(...a),
  getSeasons: (...a: unknown[]) => getSeasons(...a),
  getBrawlers: (...a: unknown[]) => getBrawlers(...a),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

const META = { source: 'fresh' as const, fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 0 };
const OPEN: Season = { id: 2, name: 'Temporada 2', startedAt: '2026-10-01T00:00:00.000Z', endedAt: null };
const CLOSED: Season = { id: 1, name: 'Temporada 1', startedAt: '2026-09-01T00:00:00.000Z', endedAt: '2026-10-01T00:00:00.000Z' };

const row = (brawlerId: number, tier: TierRow['tier'], votes: number, average = 3): TierRow => ({
  brawlerId,
  tier,
  votes,
  average,
});
const SHELLY = 16000000;
const COLT = 16000001;
const BULL = 16000002;

function tierList(rows: TierRow[], overrides: Partial<CommunityTierList> = {}): CommunityTierList {
  return { season: OPEN, voters: 12, rows, ...overrides };
}

const DEFAULT_ROWS = [row(SHELLY, 'S', 7, 4.8), row(COLT, 'B', 1, 3), row(BULL, null, 2, 2.5)];
const USER = { id: 1, username: 'MockUser', avatarUrl: null, playerTag: null, isAdmin: false };

function setup({
  list = tierList(DEFAULT_ROWS),
  session = { enabled: true, user: null } as unknown,
}: { list?: CommunityTierList; session?: unknown } = {}) {
  getCommunityTierList.mockResolvedValue({ data: list, meta: META });
  getSeasons.mockResolvedValue({ data: [OPEN, CLOSED], meta: META });
  getBrawlers.mockResolvedValue({ data: CATALOG, meta: META });
  getSession.mockResolvedValue(session);
}

const renderPage = async (sp: Record<string, string | string[] | undefined> = {}) =>
  render(await TierListPage({ searchParams: Promise.resolve(sp) } as never));

beforeEach(() => {
  getCommunityTierList.mockReset();
  getSeasons.mockReset();
  getBrawlers.mockReset();
  getSession.mockReset();
});

describe('página /tierlist', () => {
  it('muestra las filas en orden S, A, B, C, D y Pocos votos', async () => {
    setup();
    await renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['S', 'A', 'B', 'C', 'D', 'Pocos votos']);
    expect(screen.getByRole('heading', { level: 1, name: 'Tier list' })).toBeInTheDocument();
  });

  it('cada brawler cae en su fila; tier null va a "Pocos votos"; las filas vacías dicen "Sin brawlers"', async () => {
    setup();
    await renderPage();
    const s = screen.getByRole('region', { name: 'S' });
    expect(within(s).getByRole('link', { name: /Shelly/ })).toHaveAttribute('href', `/brawlers/${SHELLY}`);
    expect(within(screen.getByRole('region', { name: 'B' })).getByRole('link', { name: /Colt/ })).toBeInTheDocument();
    const low = screen.getByRole('region', { name: 'Pocos votos' });
    expect(within(low).getByRole('link', { name: /Bull/ })).toBeInTheDocument();
    for (const t of ['A', 'C', 'D']) {
      expect(within(screen.getByRole('region', { name: t })).getByText('Sin brawlers')).toBeInTheDocument();
    }
    expect(within(s).queryByText('Sin brawlers')).not.toBeInTheDocument();
  });

  it('cada carta muestra sus votos con plural correcto', async () => {
    setup();
    await renderPage();
    expect(within(screen.getByRole('region', { name: 'S' })).getByText('7 votos')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'B' })).getByText('1 voto')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Pocos votos' })).getByText('2 votos')).toBeInTheDocument();
  });

  it('los brawlers del catálogo sin fila van a "Pocos votos" con 0 votos, después de los que sí tienen votos', async () => {
    setup({ list: tierList([row(SHELLY, 'S', 7, 4.8)], { voters: 0 }) });
    await renderPage();
    const low = screen.getByRole('region', { name: 'Pocos votos' });
    const names = within(low)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(new Set(names)).toEqual(new Set(CATALOG.filter((b) => b.id !== SHELLY).map((b) => `/brawlers/${b.id}`)));
    expect(names).not.toContain(`/brawlers/${SHELLY}`);
    expect(names).toHaveLength(CATALOG.length - 1);
    expect(within(low).getAllByText('0 votos')).toHaveLength(CATALOG.length - 1);
    expect(within(low).queryByText('Sin brawlers')).not.toBeInTheDocument();
  });

  it('con filas de pocos votos, esas van antes que las de 0 votos', async () => {
    setup({ list: tierList([row(BULL, null, 2, 2.5)]) });
    await renderPage();
    const links = within(screen.getByRole('region', { name: 'Pocos votos' })).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/brawlers/${BULL}`);
  });

  it('un brawlerId que no está en el catálogo se omite sin romper', async () => {
    setup({ list: tierList([...DEFAULT_ROWS, row(99999999, 'A', 5)]) });
    await renderPage();
    expect(within(screen.getByRole('region', { name: 'A' })).getByText('Sin brawlers')).toBeInTheDocument();
  });

  it('muestra la temporada y los votantes con plural', async () => {
    setup();
    const { unmount } = await renderPage();
    expect(screen.getByText('Temporada 2 · 12 votantes')).toBeInTheDocument();
    unmount();
    setup({ list: tierList([], { voters: 1 }) });
    await renderPage();
    expect(screen.getByText('Temporada 2 · 1 votante')).toBeInTheDocument();
  });

  it('pide la temporada del query string y cae en la actual si es inválida', async () => {
    setup();
    await renderPage({ season: '1' });
    expect(getCommunityTierList).toHaveBeenLastCalledWith(1);
    await renderPage({ season: 'abc' });
    expect(getCommunityTierList).toHaveBeenLastCalledWith(undefined);
    await renderPage();
    expect(getCommunityTierList).toHaveBeenLastCalledWith(undefined);
  });

  it('el selector de temporadas lista todas, marca la actual y selecciona la que se ve', async () => {
    setup({ list: tierList(DEFAULT_ROWS, { season: CLOSED }) });
    await renderPage({ season: '1' });
    const select = screen.getByRole('combobox', { name: 'Temporada' });
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Temporada 2 (actual)', 'Temporada 1']);
    expect(select).toHaveValue('1');
    expect(select).toHaveAttribute('name', 'season');
    expect(select.closest('form')).toHaveAttribute('method', 'get');
    expect(select.closest('form')).toHaveAttribute('action', '/tierlist');
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument();
  });

  it('si fallan las temporadas, la página se ve igual sin selector', async () => {
    setup();
    getSeasons.mockRejectedValue(new ApiError('NETWORK', 'caído', { status: 0 }));
    await renderPage();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'S' })).toBeInTheDocument();
  });

  describe('CTA', () => {
    it('sin sesión: invita a entrar con un <a> plano (no un Link de Next)', async () => {
      setup();
      await renderPage();
      const a = screen.getByRole('link', { name: 'Entra con Discord para votar' });
      expect(a).toHaveAttribute('href', '/auth/discord?next=/tierlist');
      expect(a).not.toHaveAttribute('data-next-link');
      expect(screen.queryByRole('link', { name: 'Armar mi tier list' })).not.toBeInTheDocument();
    });

    it('con sesión: "Armar mi tier list" lleva al editor', async () => {
      setup({ session: { enabled: true, user: USER } });
      await renderPage();
      expect(screen.getByRole('link', { name: 'Armar mi tier list' })).toHaveAttribute('href', '/tierlist/editar');
      expect(screen.queryByText('Entra con Discord para votar')).not.toBeInTheDocument();
    });

    it('con Comunidad deshabilitada no hay CTA', async () => {
      setup({ session: { enabled: false, user: null } });
      await renderPage();
      expect(screen.queryByRole('link', { name: 'Armar mi tier list' })).not.toBeInTheDocument();
      expect(screen.queryByText('Entra con Discord para votar')).not.toBeInTheDocument();
    });
  });

  describe('estados', () => {
    it('404 (sin temporadas o temporada desconocida) → estado vacío', async () => {
      setup();
      getCommunityTierList.mockRejectedValue(new ApiError('NOT_FOUND', 'No hay una temporada abierta.', { status: 404 }));
      await renderPage();
      expect(screen.getByText('Todavía no hay una tier list')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('DB_UNAVAILABLE → "Comunidad no está disponible ahora"', async () => {
      setup();
      getCommunityTierList.mockRejectedValue(new ApiError('DB_UNAVAILABLE', 'sin base', { status: 503 }));
      await renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
    });

    it('otros errores se muestran en línea con ApiErrorView', async () => {
      setup();
      getCommunityTierList.mockRejectedValue(new ApiError('INTERNAL', 'Algo falló', { status: 500 }));
      await renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent('Algo falló');
    });

    it('si fallan los brawlers se muestra el error en línea', async () => {
      setup();
      getBrawlers.mockRejectedValue(new ApiError('NETWORK', 'No hay conexión', { status: 0 }));
      await renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión');
    });
  });
});
