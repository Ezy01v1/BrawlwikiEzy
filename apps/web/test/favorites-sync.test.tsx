import type { Favorite, User } from '@brawlwiki/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesImporter } from '@/components/account/FavoritesImporter';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { SavedList } from '@/components/search/RecentSearches';
import HomePage from '@/app/page';
import { favoriteState } from '@/lib/account-favorites';
import { toImportItems } from '@/lib/favorites';
import { clearFavorites, getFavorites as getLocalFavorites, isFavorite, toggleFavorite } from '@/lib/local-store';

let pathname = '/jugador/2PP';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  // Aquí ninguna acción redirige: no hay errores internos de Next que relanzar.
  unstable_rethrow: () => {},
}));

const addFavorite = vi.fn();
const removeFavorite = vi.fn();
const importFavorites = vi.fn();
vi.mock('@/app/favorites/actions', () => ({
  addFavorite: (...a: unknown[]) => addFavorite(...a),
  removeFavorite: (...a: unknown[]) => removeFavorite(...a),
  importFavorites: (...a: unknown[]) => importFavorites(...a),
}));

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

const getFavorites = vi.fn();
vi.mock('@/lib/queries', () => ({ getFavorites: () => getFavorites() }));

// La home trae los eventos de la API: aquí solo importan las listas.
vi.mock('@/components/events/EventRotation', () => ({ EventRotation: () => null }));

const USER: User = { id: 7, username: 'Ezy', avatarUrl: null, playerTag: null, isAdmin: false };
const FAV: Favorite = { kind: 'club', tag: '2YPLQ', name: 'Los Cracks', createdAt: '2026-10-29T12:00:00.000Z' };
const ENTRY = { type: 'player' as const, tag: '2PP', name: 'EzyPlayer' };

/** Una promesa que el test resuelve cuando quiere, para ver el estado optimista. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  pathname = '/jugador/2PP';
  addFavorite.mockReset();
  removeFavorite.mockReset();
  importFavorites.mockReset();
  getSession.mockReset();
  getFavorites.mockReset();
});

describe('FavoriteButton con sesión', () => {
  it('marcar llama a addFavorite, es optimista y no toca localStorage', async () => {
    const d = deferred<{ ok: true }>();
    addFavorite.mockReturnValue(d.promise);
    render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    const button = screen.getByRole('button', { name: 'Guardar en favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    // Optimista: ya se ve marcado antes de que responda la acción.
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(addFavorite).toHaveBeenCalledWith('player', '2PP', 'EzyPlayer');
    await act(async () => d.resolve({ ok: true }));
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('bw:favorites')).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el estado inicial viene del servidor, no de localStorage; desmarcar llama a removeFavorite', async () => {
    toggleFavorite(ENTRY); // un favorito local viejo no cuenta con sesión
    removeFavorite.mockResolvedValue({ ok: true });
    const { unmount } = render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
    unmount();
    render(<FavoriteButton entry={ENTRY} signedIn initial />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith('player', '2PP'));
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
    expect(addFavorite).not.toHaveBeenCalled();
    // El favorito local sigue intacto: con sesión el botón no lo toca.
    expect(isFavorite(ENTRY)).toBe(true);
  });

  it('si la acción falla vuelve atrás y con la sesión vencida ofrece entrar (con <a>, no <Link>)', async () => {
    addFavorite.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' });
    render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tu sesión venció');
    expect(screen.getByRole('link', { name: 'Entrar con Discord' })).toHaveAttribute(
      'href',
      '/auth/discord?next=/jugador/2PP',
    );
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('otro error también vuelve atrás y lo explica; reintentar limpia el error', async () => {
    addFavorite.mockResolvedValueOnce({ ok: false, code: 'DB_UNAVAILABLE' }).mockResolvedValueOnce({ ok: true });
    render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('si la acción se rechaza (sin red, o una pestaña vieja tras un deploy) vuelve atrás, avisa y sigue usable', async () => {
    addFavorite.mockRejectedValueOnce(new Error('Failed to find Server Action')).mockResolvedValueOnce({ ok: true });
    render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
    // El candado se liberó: el segundo clic vuelve a llamar a la acción.
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    await waitFor(() => expect(addFavorite).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un doble clic mientras la acción está en curso no manda dos pedidos', async () => {
    const d = deferred<{ ok: true }>();
    addFavorite.mockReturnValue(d.promise);
    render(<FavoriteButton entry={ENTRY} signedIn initial={false} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(removeFavorite).not.toHaveBeenCalled();
    await act(async () => d.resolve({ ok: true }));
  });

  it('sin sesión sigue usando localStorage y no llama a las acciones', async () => {
    render(<FavoriteButton entry={ENTRY} signedIn={false} initial={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(isFavorite(ENTRY)).toBe(true);
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('favoriteState (servidor)', () => {
  it('sin sesión o sin Comunidad → signedIn false y no pide favoritos', async () => {
    getSession.mockResolvedValue({ enabled: true, user: null });
    expect(await favoriteState('player', '2PP')).toEqual({ signedIn: false, initial: false });
    getSession.mockResolvedValue({ enabled: false, user: null });
    expect(await favoriteState('player', '2PP')).toEqual({ signedIn: false, initial: false });
    expect(getFavorites).not.toHaveBeenCalled();
  });

  it('con sesión, initial dice si esta entidad (kind + tag) está en la cuenta', async () => {
    getSession.mockResolvedValue({ enabled: true, user: USER });
    getFavorites.mockResolvedValue([FAV]);
    expect(await favoriteState('club', '2YPLQ')).toEqual({ signedIn: true, initial: true });
    expect(await favoriteState('player', '2YPLQ')).toEqual({ signedIn: true, initial: false });
  });
});

describe('Favoritos de la home', () => {
  it('SavedList con items del servidor los muestra e ignora localStorage', () => {
    toggleFavorite({ type: 'player', tag: '2PP', name: 'Local' });
    render(<SavedList source="favorites" items={[{ type: 'club', tag: '2YPLQ', name: 'Los Cracks' }]} />);
    expect(screen.getByText('FAVORITOS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Los Cracks/ })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.queryByRole('link', { name: /Local/ })).not.toBeInTheDocument();
  });

  it('SavedList con items vacíos no muestra nada aunque haya favoritos locales', () => {
    toggleFavorite({ type: 'player', tag: '2PP', name: 'Local' });
    const { container } = render(<SavedList source="favorites" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('con sesión la home lista los favoritos de la cuenta; los recientes siguen locales', async () => {
    getSession.mockResolvedValue({ enabled: true, user: USER });
    getFavorites.mockResolvedValue([FAV]);
    toggleFavorite({ type: 'player', tag: '2PP', name: 'FavLocal' });
    localStorage.setItem('bw:recent', JSON.stringify([{ type: 'player', tag: '9QQ', name: 'Reciente' }]));
    render(await HomePage());
    expect(screen.getByRole('link', { name: /Los Cracks/ })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.queryByRole('link', { name: /FavLocal/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Reciente/ })).toHaveAttribute('href', '/jugador/9QQ');
  });

  it('sin Comunidad la home usa los favoritos locales como hoy', async () => {
    getSession.mockResolvedValue({ enabled: false, user: null });
    toggleFavorite({ type: 'player', tag: '2PP', name: 'FavLocal' });
    render(await HomePage());
    expect(await screen.findByRole('link', { name: /FavLocal/ })).toHaveAttribute('href', '/jugador/2PP');
    expect(getFavorites).not.toHaveBeenCalled();
  });
});

describe('toImportItems', () => {
  it('pasa de type a kind, normaliza los tags, descarta los inválidos y los repetidos', () => {
    expect(
      toImportItems([
        { type: 'player', tag: '2pp', name: '  Ezy  ' },
        { type: 'club', tag: 'HOLA!' },
        { type: 'player', tag: '2PP', name: 'Repetido' },
        { type: 'club', tag: '#2yplq' },
      ]),
    ).toEqual([
      { kind: 'player', tag: '2PP', name: 'Ezy' },
      { kind: 'club', tag: '2YPLQ', name: '' },
    ]);
  });

  it('manda como máximo 100, los más recientes primero, y corta los nombres a 64', () => {
    const many = Array.from({ length: 105 }, (_, i) => ({
      type: 'player' as const,
      tag: `2${'PYLQGRJCUV'[i % 10]}${'PYLQGRJCUV0289'[Math.floor(i / 10)]}`,
      name: 'x'.repeat(80),
    }));
    const items = toImportItems(many);
    expect(items).toHaveLength(100);
    expect(items[0]!.tag).toBe(many[0]!.tag);
    expect(items[0]!.name).toHaveLength(64);
  });
});

describe('FavoritesImporter', () => {
  const seed = (n: number) => {
    for (const tag of ['2PP', '2YY', '2LL'].slice(0, n)) toggleFavorite({ type: 'player', tag, name: `J${tag}` });
  };

  it('con 3 locales llama una vez (también en StrictMode), borra bw:favorites y avisa con el número de la acción', async () => {
    seed(3);
    importFavorites.mockResolvedValue({ ok: true, imported: 2 });
    render(
      <StrictMode>
        <FavoritesImporter />
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subimos tus 2 favoritos a tu cuenta'));
    expect(importFavorites).toHaveBeenCalledTimes(1);
    expect(importFavorites).toHaveBeenCalledWith([
      { kind: 'player', tag: '2LL', name: 'J2LL' },
      { kind: 'player', tag: '2YY', name: 'J2YY' },
      { kind: 'player', tag: '2PP', name: 'J2PP' },
    ]);
    expect(localStorage.getItem('bw:favorites')).toBeNull();
    expect(getLocalFavorites()).toEqual([]);
  });

  it('el aviso se puede cerrar', async () => {
    seed(1);
    importFavorites.mockResolvedValue({ ok: true, imported: 1 });
    render(<FavoritesImporter />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subimos tu favorito a tu cuenta'));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('sin favoritos locales no llama a la acción ni muestra nada', async () => {
    render(<FavoritesImporter />);
    await act(async () => {});
    expect(importFavorites).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('si todos los locales tienen tags inválidos no llama a la acción', async () => {
    localStorage.setItem('bw:favorites', JSON.stringify([{ type: 'player', tag: 'HOLA!' }]));
    render(<FavoritesImporter />);
    await act(async () => {});
    expect(importFavorites).not.toHaveBeenCalled();
  });

  it('si la acción devuelve 0 (ya estaban en la cuenta) borra los locales sin avisar', async () => {
    seed(2);
    importFavorites.mockResolvedValue({ ok: true, imported: 0 });
    render(<FavoritesImporter />);
    await waitFor(() => expect(getLocalFavorites()).toEqual([]));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('si la acción falla deja los locales para reintentar en la próxima carga y no avisa', async () => {
    seed(3);
    importFavorites.mockResolvedValue({ ok: false, code: 'DB_UNAVAILABLE' });
    const { unmount } = render(<FavoritesImporter />);
    await waitFor(() => expect(importFavorites).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(getLocalFavorites()).toHaveLength(3);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    unmount();
    importFavorites.mockResolvedValue({ ok: true, imported: 3 });
    render(<FavoritesImporter />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subimos tus 3 favoritos a tu cuenta'));
    expect(importFavorites).toHaveBeenCalledTimes(2);
  });

  it('si la acción se rechaza deja los locales y no avisa', async () => {
    seed(2);
    importFavorites.mockRejectedValue(new Error('Failed to fetch'));
    render(<FavoritesImporter />);
    await waitFor(() => expect(importFavorites).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(getLocalFavorites()).toHaveLength(2);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('con más de 100 importa los 100 más recientes y deja el resto para la próxima carga', async () => {
    const many = Array.from({ length: 130 }, (_, i) => ({
      type: 'player' as const,
      tag: `2${'PYLQGRJCUV'[i % 10]}${'PYLQGRJCUV0289'[Math.floor(i / 10)]}`,
      name: `J${i}`,
    }));
    // Más uno inválido entre medio: no se sube ni se guarda de vuelta.
    localStorage.setItem('bw:favorites', JSON.stringify([...many.slice(0, 50), { type: 'club', tag: 'HOLA!' }, ...many.slice(50)]));
    importFavorites.mockResolvedValue({ ok: true, imported: 100 });
    render(<FavoritesImporter />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subimos tus 100 favoritos a tu cuenta'));
    const sent = importFavorites.mock.calls[0]![0] as { tag: string }[];
    expect(sent).toHaveLength(100);
    expect(sent.map((i) => i.tag)).toEqual(many.slice(0, 100).map((e) => e.tag));
    expect(getLocalFavorites()).toEqual(many.slice(100));
  });

  it('dos montados a la vez importan una sola vez', async () => {
    seed(2);
    const d = deferred<{ ok: true; imported: number }>();
    importFavorites.mockReturnValue(d.promise);
    render(
      <>
        <FavoritesImporter />
        <FavoritesImporter />
      </>,
    );
    await act(async () => d.resolve({ ok: true, imported: 2 }));
    expect(importFavorites).toHaveBeenCalledTimes(1);
    expect(getLocalFavorites()).toEqual([]);
  });
});

describe('clearFavorites', () => {
  it('borra bw:favorites y no lanza sin almacenamiento', () => {
    toggleFavorite(ENTRY);
    clearFavorites();
    expect(localStorage.getItem('bw:favorites')).toBeNull();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearFavorites()).not.toThrow();
  });
});
