import type { User } from '@brawlwiki/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimTag } from '@/components/account/ClaimTag';
import { ClaimTagButton } from '@/components/account/ClaimTagButton';
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { LinkTagForm } from '@/components/account/LinkTagForm';
import { LoginNotice } from '@/components/account/LoginNotice';
import { Header } from '@/components/layout/Header';
import { NavLinks } from '@/components/layout/NavLinks';
import CuentaPage from '@/app/cuenta/page';
import HomePage from '@/app/page';

let pathname = '/';
let search = new URLSearchParams();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => search,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (url: string) => redirect(url),
}));

// Marca los <Link> de Next: el login no puede ser uno, porque Next lo prefetchearía y arrancaría el OAuth.
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) =>
    createElement('a', { href, 'data-next-link': '', ...rest }, children),
}));

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

const linkTag = vi.fn();
const deleteAccount = vi.fn();
vi.mock('@/app/cuenta/actions', () => ({
  linkTag: (...a: unknown[]) => linkTag(...a),
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

// La home trae los eventos y, con sesión, los favoritos de la API: aquí solo importa el acceso a "Mi perfil".
vi.mock('@/components/events/EventRotation', () => ({ EventRotation: () => null }));
vi.mock('@/lib/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/queries')>()),
  getFavorites: async () => [],
}));

const USER: User = { id: 7, username: 'Ezy Brawler', avatarUrl: null, playerTag: null, isAdmin: false };

beforeEach(() => {
  pathname = '/';
  search = new URLSearchParams();
  redirect.mockClear();
  getSession.mockReset();
  linkTag.mockReset();
  deleteAccount.mockReset();
});

describe('Header con Comunidad', () => {
  it('sin sesión muestra "Entrar" con next = la ruta actual', async () => {
    pathname = '/rankings';
    getSession.mockResolvedValue({ enabled: true, user: null });
    render(await Header({}));
    const login = screen.getByRole('link', { name: 'Entrar' });
    expect(login).toHaveAttribute('href', '/auth/discord?next=/rankings');
    expect(login.tagName).toBe('A');
    expect(login).not.toHaveAttribute('data-next-link');
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
  });

  it('"Entrar" codifica lo que no es una ruta simple', async () => {
    pathname = '/jugador/a&b';
    getSession.mockResolvedValue({ enabled: true, user: null });
    render(await Header({}));
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/auth/discord?next=/jugador/a%26b');
  });

  it('con sesión muestra el avatar con link a /cuenta, sin "Mi perfil" si no hay tag', async () => {
    getSession.mockResolvedValue({ enabled: true, user: USER });
    render(await Header({}));
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/cuenta');
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument();
  });

  it('con playerTag muestra "Mi perfil" → /jugador/<tag>', async () => {
    getSession.mockResolvedValue({ enabled: true, user: { ...USER, playerTag: '2PP' } });
    render(await Header({}));
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/jugador/2PP');
  });

  it('Comunidad deshabilitada: ni "Entrar" ni avatar; Clubes sigue en el header y Tier list en el menú', async () => {
    getSession.mockResolvedValue({ enabled: false, user: null });
    render(
      <>
        {await Header({})}
        <NavLinks variant="bottom" />
      </>,
    );
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
    // Dos copias: dentro de la navegación principal (escritorio) y suelta en la fila del header (móvil).
    const clubs = within(screen.getByRole('banner')).getAllByRole('link', { name: 'Clubes' });
    expect(clubs).toHaveLength(2);
    for (const link of clubs) expect(link).toHaveAttribute('href', '/clubes/comparar');
    const main = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(main).getByRole('link', { name: 'Clubes' })).toHaveAttribute('href', '/clubes/comparar');
    const nav = screen.getByRole('navigation', { name: 'Navegación inferior' });
    expect(within(nav).getByRole('link', { name: /Tier list/ })).toHaveAttribute('href', '/tierlist');
  });

  it('el link Clubes del header se marca activo en las páginas de clubes', async () => {
    pathname = '/club/2YPLQ';
    getSession.mockResolvedValue({ enabled: false, user: null });
    render(await Header({}));
    for (const link of within(screen.getByRole('banner')).getAllByRole('link', { name: 'Clubes' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
  });
});

describe('/cuenta', () => {
  it('sin sesión redirige al login con next=/cuenta', async () => {
    getSession.mockResolvedValue({ enabled: true, user: null });
    await expect(CuentaPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/auth/discord?next=/cuenta');
  });

  it('Comunidad deshabilitada → estado vacío, sin redirigir', async () => {
    getSession.mockResolvedValue({ enabled: false, user: null });
    render(await CuentaPage());
    expect(screen.getByText('Comunidad no está disponible ahora')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('con sesión: nombre, tag vinculado, cerrar sesión (POST a /auth/logout) y borrar cuenta', async () => {
    getSession.mockResolvedValue({ enabled: true, user: { ...USER, playerTag: '2PP' } });
    const { container } = render(await CuentaPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Ezy Brawler')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#2PP' })).toHaveAttribute('href', '/jugador/2PP');
    expect(screen.getByRole('button', { name: 'Quitar tag' })).toBeInTheDocument();
    const logout = screen.getByRole('button', { name: 'Cerrar sesión' }).closest('form');
    expect(logout).toHaveAttribute('method', 'post');
    expect(logout).toHaveAttribute('action', '/auth/logout');
    expect(screen.getByRole('button', { name: 'Borrar cuenta' })).toBeDisabled();
    expect(container.querySelector('img[alt]:not([alt=""])')).toBeNull();
  });

  it('sin tag vinculado lo explica y no ofrece quitarlo', async () => {
    getSession.mockResolvedValue({ enabled: true, user: USER });
    render(await CuentaPage());
    expect(screen.getByText(/Todavía no vinculaste tu tag/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar tag' })).not.toBeInTheDocument();
  });
});

describe('DeleteAccountForm', () => {
  it('el botón queda deshabilitado hasta escribir exactamente "BORRAR"', async () => {
    const user = userEvent.setup();
    deleteAccount.mockResolvedValue({ ok: false, code: 'DB_UNAVAILABLE' });
    render(<DeleteAccountForm />);
    const button = screen.getByRole('button', { name: 'Borrar cuenta' });
    const input = screen.getByLabelText('Escribe BORRAR para confirmar');
    expect(button).toBeDisabled();
    await user.type(input, 'borrar');
    expect(button).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'BORRAR');
    expect(button).toBeEnabled();
    expect(input).toHaveAccessibleDescription(expect.stringContaining('No se puede deshacer'));
    await user.click(button);
    expect(deleteAccount).toHaveBeenCalledWith('BORRAR');
    expect(await screen.findByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
  });
});

describe('"Este soy yo"', () => {
  it('solo aparece con sesión, con Comunidad activa y si el tag no es el vinculado', async () => {
    getSession.mockResolvedValue({ enabled: true, user: null });
    expect(await ClaimTag({ tag: '2PP' })).toBeNull();
    getSession.mockResolvedValue({ enabled: false, user: null });
    expect(await ClaimTag({ tag: '2PP' })).toBeNull();
    getSession.mockResolvedValue({ enabled: true, user: { ...USER, playerTag: '2PP' } });
    const linked = render(await ClaimTag({ tag: '2PP' }));
    expect(screen.queryByRole('button', { name: 'Este soy yo' })).not.toBeInTheDocument();
    linked.unmount();
    getSession.mockResolvedValue({ enabled: true, user: { ...USER, playerTag: '8CGRV' } });
    render(await ClaimTag({ tag: '2PP' }));
    expect(screen.getByRole('button', { name: 'Este soy yo' })).toBeInTheDocument();
  });

  it('al vincular, el botón desaparece (revalidación) y un status persistente anuncia "Tag vinculado"', async () => {
    const user = userEvent.setup();
    linkTag.mockResolvedValue({ ok: true });
    const { rerender } = render(<ClaimTagButton tag="2PP" linked={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Este soy yo' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tag vinculado'));
    // Lo que hace revalidatePath: el servidor vuelve a renderizar ya con el tag vinculado.
    rerender(<ClaimTagButton tag="2PP" linked />);
    expect(screen.queryByRole('button', { name: 'Este soy yo' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tag vinculado');
  });

  it('vincula el tag; si la sesión venció ofrece entrar de nuevo', async () => {
    const user = userEvent.setup();
    pathname = '/jugador/2PP';
    getSession.mockResolvedValue({ enabled: true, user: USER });
    linkTag.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' });
    render(await ClaimTag({ tag: '2PP' }));
    await user.click(screen.getByRole('button', { name: 'Este soy yo' }));
    expect(linkTag).toHaveBeenCalledWith('2PP');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión venció');
    const login = screen.getByRole('link', { name: 'Entrar con Discord' });
    expect(login).toHaveAttribute('href', '/auth/discord?next=/jugador/2PP');
    expect(login).not.toHaveAttribute('data-next-link');
  });
});

describe('LinkTagForm', () => {
  it('valida el tag antes de llamar a la acción y lo guarda normalizado', async () => {
    const user = userEvent.setup();
    linkTag.mockResolvedValue({ ok: true });
    render(<LinkTagForm current={null} />);
    const input = screen.getByLabelText('Tu tag de Brawl Stars');
    await user.type(input, 'hola');
    await user.click(screen.getByRole('button', { name: 'Guardar tag' }));
    expect(linkTag).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Ese tag no es válido');
    await user.clear(input);
    await user.type(input, '#2pp');
    await user.click(screen.getByRole('button', { name: 'Guardar tag' }));
    expect(linkTag).toHaveBeenCalledWith('2PP');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tag guardado'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Quitar tag" desvincula con null', async () => {
    const user = userEvent.setup();
    linkTag.mockResolvedValue({ ok: true });
    render(<LinkTagForm current="2PP" />);
    expect(screen.getByRole('button', { name: 'Cambiar tag' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar tag' }));
    expect(linkTag).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tag quitado'));
  });
});

describe('LoginNotice', () => {
  it('?login=error y ?logout=error muestran su aviso; sin parámetros no muestra nada', () => {
    search = new URLSearchParams('login=error');
    const { unmount } = render(<LoginNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo iniciar sesión con Discord');
    unmount();
    search = new URLSearchParams('logout=error');
    const second = render(<LoginNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    second.unmount();
    search = new URLSearchParams('tab=brawlers');
    const { container } = render(<LoginNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Home', () => {
  it('con un tag vinculado muestra "Mi perfil" arriba de la búsqueda', async () => {
    getSession.mockResolvedValue({ enabled: true, user: { ...USER, playerTag: '2PP' } });
    render(await HomePage());
    const link = screen.getByRole('link', { name: /Mi perfil/ });
    expect(link).toHaveAttribute('href', '/jugador/2PP');
    expect(link.compareDocumentPosition(screen.getByRole('search')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sin tag vinculado no hay acceso a "Mi perfil"', async () => {
    getSession.mockResolvedValue({ enabled: true, user: USER });
    render(await HomePage());
    expect(screen.queryByRole('link', { name: /Mi perfil/ })).not.toBeInTheDocument();
  });
});
