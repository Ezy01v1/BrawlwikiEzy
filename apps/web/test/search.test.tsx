import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { RecentSearches, SavedList } from '@/components/search/RecentSearches';
import { TagSearch } from '@/components/search/TagSearch';
import { addRecent, getFavorites, getRecent, isFavorite, MAX_RECENT, toggleFavorite } from '@/lib/local-store';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  push.mockClear();
  vi.restoreAllMocks();
});

describe('local-store', () => {
  it('recientes: sin duplicados, el más nuevo primero, máximo 10', () => {
    for (let i = 0; i < 12; i++) addRecent({ type: 'player', tag: `2P${'P'.repeat(i % 3)}${i}` });
    addRecent({ type: 'player', tag: '2PP0' });
    const list = getRecent();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.tag).toBe('2PP0');
    expect(list.filter((e) => e.tag === '2PP0')).toHaveLength(1);
  });

  it('addRecent con nombre reemplaza la entrada anterior', () => {
    addRecent({ type: 'player', tag: '2PP' });
    addRecent({ type: 'player', tag: '2PP', name: 'EzyPlayer' });
    expect(getRecent()).toEqual([{ type: 'player', tag: '2PP', name: 'EzyPlayer' }]);
  });

  it('JSON corrupto o con otra forma → []', () => {
    localStorage.setItem('bw:recent', '{no es json');
    expect(getRecent()).toEqual([]);
    localStorage.setItem('bw:recent', JSON.stringify({ a: 1 }));
    expect(getRecent()).toEqual([]);
    localStorage.setItem('bw:recent', JSON.stringify([{ type: 'player', tag: '2PP' }, { basura: true }]));
    expect(getRecent()).toEqual([{ type: 'player', tag: '2PP' }]);
  });

  it('localStorage no disponible → no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getRecent()).toEqual([]);
    expect(() => addRecent({ type: 'player', tag: '2PP' })).not.toThrow();
    expect(() => toggleFavorite({ type: 'club', tag: '2YPLQ' })).not.toThrow();
  });

  it('favoritos: toggle on/off', () => {
    const club = { type: 'club' as const, tag: '2YPLQ', name: 'Los Cracks' };
    expect(toggleFavorite(club)).toBe(true);
    expect(isFavorite(club)).toBe(true);
    expect(getFavorites()).toEqual([club]);
    expect(toggleFavorite(club)).toBe(false);
    expect(isFavorite(club)).toBe(false);
  });
});

describe('TagSearch', () => {
  it('normaliza " #2pp " y navega al perfil sin guardar el reciente (lo guarda el perfil al cargar)', async () => {
    render(<TagSearch />);
    await userEvent.type(screen.getByLabelText('Tag del jugador'), ' #2pp ');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith('/jugador/2PP');
    expect(getRecent()).toEqual([]);
  });

  it('tag inválido → error en línea y no navega', async () => {
    render(<TagSearch />);
    const input = screen.getByLabelText('Tag del jugador');
    await userEvent.type(input, 'hola!');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('0289PYLQGRJCUV');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });

  it('target club navega a /club/TAG', async () => {
    render(<TagSearch target="club" />);
    await userEvent.type(screen.getByLabelText('Tag del club'), '2yplq');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith('/club/2YPLQ');
  });
});

describe('FavoriteButton y RecentSearches', () => {
  it('FavoriteButton alterna aria-pressed y persiste', async () => {
    render(<FavoriteButton entry={{ type: 'player', tag: '2PP', name: 'EzyPlayer' }} />);
    const button = screen.getByRole('button', { name: 'Guardar en favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(isFavorite({ type: 'player', tag: '2PP' })).toBe(true);
  });

  it('RecentSearches lista los recientes con link y no muestra nada si está vacío', async () => {
    const { container, unmount } = render(<RecentSearches />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    addRecent({ type: 'club', tag: '2YPLQ' });
    addRecent({ type: 'player', tag: '2PP', name: 'EzyPlayer' });
    render(<RecentSearches />);
    await waitFor(() => expect(screen.getByRole('link', { name: /EzyPlayer/ })).toHaveAttribute('href', '/jugador/2PP'));
    expect(screen.getByRole('link', { name: /#2YPLQ/ })).toHaveAttribute('href', '/club/2YPLQ');
  });

  it('SavedList de favoritos lista el link al perfil y no muestra nada si está vacío', async () => {
    const { container, unmount } = render(<SavedList source="favorites" />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    toggleFavorite({ type: 'player', tag: '2PP', name: 'EzyPlayer' });
    render(<SavedList source="favorites" />);
    await waitFor(() => expect(screen.getByText('FAVORITOS')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /EzyPlayer/ })).toHaveAttribute('href', '/jugador/2PP');
  });
});
