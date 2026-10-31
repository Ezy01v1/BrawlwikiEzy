import { type Season, SeasonSchema } from '@brawlwiki/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openSeason } from '@/app/admin/actions';
import AdminPage from '@/app/admin/page';
import { ApiError } from '@/lib/api';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => notFound(),
  // Como el real: relanza lo que lance Next (redirect / notFound).
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message.startsWith('NEXT_')) throw e;
  },
}));

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

const getSeasons = vi.fn();
vi.mock('@/lib/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/queries')>()),
  getSeasons: (...a: unknown[]) => getSeasons(...a),
}));

// El formulario (cliente) importa la acción; en estos tests se reemplaza. Los tests de la acción real
// la cargan con `vi.importActual`.
const openSeasonMock = vi.fn();
vi.mock('@/app/admin/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/admin/actions')>();
  return { openSeason: (...a: unknown[]) => (useReal ? actual.openSeason(...(a as [string])) : openSeasonMock(...a)) };
});
let useReal = false;

const apiRequest = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
}));
const HEADERS = new Map([
  ['x-forwarded-for', '198.51.100.9'],
  ['cookie', 'bw_session=tok'],
]);
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => HEADERS.get(k.toLowerCase()) ?? null }),
}));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const META = { source: 'fresh' as const, fetchedAt: '2026-10-30T12:00:00.000Z', ageSeconds: 0 };
const OPEN: Season = { id: 2, name: 'Temporada 2', startedAt: '2026-10-01T00:00:00.000Z', endedAt: null };
const CLOSED: Season = { id: 1, name: 'Temporada 1', startedAt: '2026-09-01T00:00:00.000Z', endedAt: '2026-10-01T00:00:00.000Z' };
const ADMIN = { id: 1, username: 'MockUser', avatarUrl: null, playerTag: null, isAdmin: true };
const CTX = { forwardedFor: '198.51.100.9', cookie: 'bw_session=tok', origin: expect.any(String) };

beforeEach(() => {
  useReal = false;
  notFound.mockClear();
  getSession.mockReset();
  getSeasons.mockReset();
  openSeasonMock.mockReset();
  apiRequest.mockReset();
  revalidatePath.mockReset();
  getSeasons.mockResolvedValue({ data: [OPEN, CLOSED], meta: META });
});

const renderPage = async () => render(await AdminPage());

describe('página /admin', () => {
  it.each([
    ['sin sesión', { enabled: true, user: null }],
    ['usuario sin isAdmin', { enabled: true, user: { ...ADMIN, isAdmin: false } }],
    ['Comunidad deshabilitada', { enabled: false, user: null }],
  ])('%s → notFound()', async (_label, session) => {
    getSession.mockResolvedValue(session);
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(getSeasons).not.toHaveBeenCalled();
  });

  it('admin: título, aviso y temporadas (más nueva primero) con "Activa" en la abierta', async () => {
    getSession.mockResolvedValue({ enabled: true, user: ADMIN });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Temporadas' });
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Temporada 2');
    expect(items[0]).toHaveTextContent('Activa');
    expect(items[0]).toHaveTextContent('1/10/2026');
    expect(items[1]).toHaveTextContent('Temporada 1');
    expect(items[1]).not.toHaveTextContent('Activa');
    expect(screen.getByText(/cierra la temporada actual/i)).toBeInTheDocument();
    expect(screen.getByText(/votos de la temporada anterior/i)).toBeInTheDocument();
  });

  it('si fallan las temporadas muestra el error en línea y deja el formulario', async () => {
    getSession.mockResolvedValue({ enabled: true, user: ADMIN });
    getSeasons.mockRejectedValue(new ApiError('INTERNAL', 'Algo falló', { status: 500 }));
    await renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Algo falló');
    expect(screen.getByRole('button', { name: 'Abrir temporada' })).toBeInTheDocument();
  });
});

describe('formulario "Abrir temporada nueva"', () => {
  async function setup() {
    getSession.mockResolvedValue({ enabled: true, user: ADMIN });
    await renderPage();
    const input = screen.getByLabelText('Nombre de la temporada');
    const submit = screen.getByRole('button', { name: 'Abrir temporada' });
    return { input, submit, user: userEvent.setup() };
  }

  it('llama a openSeason con el nombre sin espacios sobrantes', async () => {
    openSeasonMock.mockResolvedValue({ ok: true });
    const { input, submit, user } = await setup();
    await user.type(input, '  Temporada 3  ');
    await user.click(submit);
    await waitFor(() => expect(openSeasonMock).toHaveBeenCalledWith('Temporada 3'));
  });

  it('éxito → "Temporada abierta" y el input se vacía', async () => {
    openSeasonMock.mockResolvedValue({ ok: true });
    const { input, submit, user } = await setup();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.type(input, 'Temporada 3');
    await user.click(submit);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Temporada abierta'));
    expect(input).toHaveValue('');
  });

  it('nombre vacío → error en línea sin llamar a la acción', async () => {
    const { input, submit, user } = await setup();
    await user.type(input, '   ');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre de 1 a 64 caracteres');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    expect(openSeasonMock).not.toHaveBeenCalled();
  });

  it('65 caracteres → error en línea sin llamar a la acción; 64 sí pasa', async () => {
    openSeasonMock.mockResolvedValue({ ok: true });
    const { input, submit, user } = await setup();
    await user.click(input);
    await user.paste('a'.repeat(65));
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('1 a 64 caracteres');
    expect(openSeasonMock).not.toHaveBeenCalled();
    await user.clear(input);
    await user.paste('a'.repeat(64));
    await user.click(submit);
    await waitFor(() => expect(openSeasonMock).toHaveBeenCalledWith('a'.repeat(64)));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('acción rechazada → error NETWORK y el formulario queda usable', async () => {
    openSeasonMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    const { input, submit, user } = await setup();
    await user.type(input, 'Temporada 3');
    await user.click(submit);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora'));
    expect(submit).toBeEnabled();
    expect(input).toHaveValue('Temporada 3');
    openSeasonMock.mockResolvedValueOnce({ ok: true });
    await user.click(submit);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Temporada abierta'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('UNAUTHENTICATED → "Tu sesión venció" y un <a> plano al login que vuelve a /admin', async () => {
    openSeasonMock.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' });
    const { input, submit, user } = await setup();
    await user.type(input, 'Temporada 3');
    await user.click(submit);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tu sesión venció');
    expect(within(alert).getByRole('link', { name: 'Entrar con Discord' })).toHaveAttribute('href', '/auth/discord?next=/admin');
  });

  it('FORBIDDEN → mensaje de falta de permiso', async () => {
    openSeasonMock.mockResolvedValue({ ok: false, code: 'FORBIDDEN' });
    const { input, submit, user } = await setup();
    await user.type(input, 'Temporada 3');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
  });

  it('doble envío síncrono (sin esperar un render) llama una sola vez a la acción', async () => {
    let resolve!: (v: { ok: true }) => void;
    openSeasonMock.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { input, submit, user } = await setup();
    await user.type(input, 'Temporada 3');
    const form = submit.closest('form')!;
    // Dos submit seguidos en el mismo tick: el botón aún no alcanzó a deshabilitarse, solo el ref frena el segundo.
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(openSeasonMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Temporada abierta'));
    expect(openSeasonMock).toHaveBeenCalledTimes(1);
    expect(submit).toBeEnabled();
  });

  it('al editar el input se limpian el estado "Temporada abierta" y el error del nombre', async () => {
    openSeasonMock.mockResolvedValue({ ok: true });
    const { input, submit, user } = await setup();
    await user.click(submit);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(input, 'T');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
    await user.click(submit);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Temporada abierta'));
    await user.type(input, 'N');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('openSeason (Server Action)', () => {
  beforeEach(() => {
    useReal = true;
  });

  it('POST /seasons con el nombre sin espacios, cookie, origin y XFF; revalida /admin y /tierlist', async () => {
    apiRequest.mockResolvedValue({ data: OPEN, meta: META });
    expect(await openSeason('  Temporada 3 ')).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('POST', '/seasons', SeasonSchema, { body: { name: 'Temporada 3' }, ...CTX });
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
    expect(revalidatePath).toHaveBeenCalledWith('/tierlist');
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['65 caracteres', 'a'.repeat(65)],
    ['no es texto', 42],
    ['null', null],
    ['objeto', { name: 'x' }],
  ])('nombre inválido (%s) → INVALID_PARAM sin llamar a la API', async (_label, name) => {
    expect(await openSeason(name as never)).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(apiRequest).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('64 caracteres es válido', async () => {
    apiRequest.mockResolvedValue({ data: OPEN, meta: META });
    expect(await openSeason('a'.repeat(64))).toEqual({ ok: true });
  });

  it('404 NOT_FOUND con sesión iniciada (no es admin) → FORBIDDEN, sin revalidar', async () => {
    getSession.mockResolvedValue({ enabled: true, user: ADMIN });
    apiRequest.mockRejectedValue(new ApiError('NOT_FOUND', 'No encontrado', { status: 404 }));
    expect(await openSeason('Temporada 3')).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND sin sesión (venció tras cargar /admin) → UNAUTHENTICATED', async () => {
    getSession.mockResolvedValue({ enabled: true, user: null });
    apiRequest.mockRejectedValue(new ApiError('NOT_FOUND', 'No encontrado', { status: 404 }));
    expect(await openSeason('Temporada 3')).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND con Comunidad deshabilitada → FORBIDDEN', async () => {
    getSession.mockResolvedValue({ enabled: false, user: null });
    apiRequest.mockRejectedValue(new ApiError('NOT_FOUND', 'No encontrado', { status: 404 }));
    expect(await openSeason('Temporada 3')).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('404 NOT_FOUND y getSession lanza (respuesta inesperada de /me) → FORBIDDEN, sin lanzar', async () => {
    getSession.mockRejectedValue(new Error('x'));
    apiRequest.mockRejectedValue(new ApiError('NOT_FOUND', 'No encontrado', { status: 404 }));
    expect(await openSeason('Temporada 3')).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('solo consulta la sesión en el camino de fallo 404', async () => {
    apiRequest.mockResolvedValue({ data: OPEN, meta: META });
    await openSeason('Temporada 3');
    apiRequest.mockRejectedValue(new ApiError('RATE_LIMITED', 'x', { status: 429 }));
    await openSeason('Temporada 3');
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each(['UNAUTHENTICATED', 'INVALID_PARAM', 'RATE_LIMITED', 'DB_UNAVAILABLE', 'FORBIDDEN'] as const)(
    '%s se pasa tal cual',
    async (code) => {
      apiRequest.mockRejectedValue(new ApiError(code, 'x', { status: 400 }));
      expect(await openSeason('Temporada 3')).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it('un error inesperado no se lanza: INTERNAL', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiRequest.mockRejectedValue(new Error('boom'));
    expect(await openSeason('Temporada 3')).toEqual({ ok: false, code: 'INTERNAL' });
    spy.mockRestore();
  });
});
