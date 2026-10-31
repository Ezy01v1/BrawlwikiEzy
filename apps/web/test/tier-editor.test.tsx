import type { MyTierList, Season } from '@brawlwiki/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TierEditPage from '@/app/tierlist/editar/page';
import { type EditorBrawler, TierEditor } from '@/components/tierlist/TierEditor';
import { ApiError } from '@/lib/api';
import { CATALOG } from './fixtures';

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/tierlist/editar',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (url: string) => redirect(url),
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message.startsWith('NEXT_REDIRECT')) throw e;
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) =>
    createElement('a', { href, ...rest }, children),
}));

const saveTierList = vi.fn();
vi.mock('@/app/tierlist/actions', () => ({ saveTierList: (...a: unknown[]) => saveTierList(...a) }));

const getMyTierList = vi.fn();
const getBrawlers = vi.fn();
vi.mock('@/lib/queries', () => ({
  getMyTierList: () => getMyTierList(),
  getBrawlers: () => getBrawlers(),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

const SHELLY = 16000000;
const COLT = 16000001;
const BULL = 16000002;
const BROCK = 16000003;
const SEASON: Season = { id: 2, name: 'Temporada 2', startedAt: '2026-10-01T00:00:00.000Z', endedAt: null };
const DRAFT_KEY = 'bw:tier-draft:2';
const META = { source: 'fresh' as const, fetchedAt: '2026-10-30T12:00:00.000Z', ageSeconds: 0 };
const USER = { id: 1, username: 'MockUser', avatarUrl: null, playerTag: null, isAdmin: false };

const BRAWLERS: EditorBrawler[] = [
  { id: SHELLY, name: 'Shelly', imageUrl: null, color: null },
  { id: COLT, name: 'Colt', imageUrl: null, color: null },
  { id: BULL, name: 'Bull', imageUrl: null, color: '#68fd58' },
  { id: BROCK, name: 'Brock', imageUrl: null, color: null },
];

function renderEditor(votes: { brawlerId: number; tier: number }[] = [{ brawlerId: SHELLY, tier: 5 }], brawlers = BRAWLERS) {
  return render(<TierEditor season={SEASON} brawlers={brawlers} initialVotes={votes} />);
}

const save = () => screen.getByRole('button', { name: 'Guardar' });

/** beforeunload cancelado = el navegador pregunta antes de salir. */
function leaveIsBlocked(): boolean {
  const ev = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

async function choose(user: ReturnType<typeof userEvent.setup>, card: string, option: string) {
  await user.click(screen.getByRole('button', { name: card }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: option }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  saveTierList.mockReset();
  redirect.mockClear();
  getMyTierList.mockReset();
  getBrawlers.mockReset();
  getSession.mockReset();
});

describe('TierEditor', () => {
  it('muestra todos los brawlers ordenados por nombre, como botones con su tier', () => {
    renderEditor();
    const grid = screen.getByRole('list', { name: 'Brawlers' });
    const names = within(grid)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Brock, sin ubicar', 'Bull, sin ubicar', 'Colt, sin ubicar', 'Shelly, tier S']);
  });

  it('el resumen cuenta por tier y los sin ubicar', () => {
    renderEditor();
    const summary = screen.getByRole('list', { name: 'Resumen por tier' });
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'S: 1',
      'A: 0',
      'B: 0',
      'C: 0',
      'D: 0',
      'Sin ubicar: 3',
    ]);
  });

  it('tocar una carta abre un diálogo con S A B C D y "Sin ubicar", marcando el actual', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shelly, tier S' }));
    const dialog = screen.getByRole('dialog', { name: 'Shelly' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (const option of ['S', 'A', 'B', 'C', 'D', 'Sin ubicar']) {
      expect(within(dialog).getByRole('button', { name: option })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    // El foco entra al diálogo, en la opción actual.
    expect(within(dialog).getByRole('button', { name: 'S' })).toHaveFocus();
  });

  it('el foco queda atrapado en el diálogo (Tab y Shift+Tab dan la vuelta)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Colt, sin ubicar' }));
    const dialog = screen.getByRole('dialog', { name: 'Colt' });
    const last = within(dialog).getByRole('button', { name: 'Sin ubicar' });
    expect(last).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('Escape cierra y el foco vuelve a la carta', async () => {
    const user = userEvent.setup();
    renderEditor();
    const card = screen.getByRole('button', { name: 'Colt, sin ubicar' });
    await user.click(card);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  it('"Cerrar" y el fondo también cierran sin cambiar nada', async () => {
    const user = userEvent.setup();
    renderEditor();
    const card = screen.getByRole('button', { name: 'Colt, sin ubicar' });
    await user.click(card);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
    await user.click(card);
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveAccessibleName('Colt, sin ubicar');
    expect(save()).toBeDisabled();
  });

  it('elegir A actualiza la carta y el resumen ("A: 1"), cierra y devuelve el foco', async () => {
    const user = userEvent.setup();
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: 'Colt, tier A' });
    expect(card).toHaveFocus();
    expect(screen.getByText('A: 1')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicar: 2')).toBeInTheDocument();
  });

  it('"Guardar" está deshabilitado sin cambios y, con cambios, avisa antes de salir', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(save()).toBeDisabled();
    expect(leaveIsBlocked()).toBe(false);
    await choose(user, 'Colt, sin ubicar', 'B');
    expect(save()).toBeEnabled();
    expect(leaveIsBlocked()).toBe(true);
    // Volver al estado cargado ya no es un cambio.
    await choose(user, 'Colt, tier B', 'Sin ubicar');
    expect(save()).toBeDisabled();
    expect(leaveIsBlocked()).toBe(false);
  });

  it('guarda todos los ubicados (no los "Sin ubicar"), anuncia y deja de avisar al salir', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: true });
    renderEditor([
      { brawlerId: SHELLY, tier: 5 },
      { brawlerId: BULL, tier: 2 },
    ]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await choose(user, 'Colt, sin ubicar', 'A');
    await choose(user, 'Bull, tier C', 'Sin ubicar');
    await user.click(save());
    expect(saveTierList).toHaveBeenCalledWith([
      { brawlerId: SHELLY, tier: 5 },
      { brawlerId: COLT, tier: 4 },
    ]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tu tier list se guardó'));
    expect(save()).toBeDisabled();
    expect(leaveIsBlocked()).toBe(false);
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cada cambio queda como borrador en sessionStorage', async () => {
    const user = userEvent.setup();
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    expect(JSON.parse(window.sessionStorage.getItem(DRAFT_KEY)!)).toEqual({ [SHELLY]: 5, [COLT]: 4 });
  });

  it('sesión vencida: "Tu sesión venció" con link al login y el borrador sigue guardado', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' });
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    await user.click(save());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tu sesión venció');
    expect(within(alert).getByRole('link', { name: 'Entrar con Discord' })).toHaveAttribute(
      'href',
      '/auth/discord?next=/tierlist/editar',
    );
    expect(JSON.parse(window.sessionStorage.getItem(DRAFT_KEY)!)).toEqual({ [SHELLY]: 5, [COLT]: 4 });
    expect(save()).toBeEnabled();
    expect(leaveIsBlocked()).toBe(true);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('al volver, el borrador se restaura y cuenta como cambio sin guardar', async () => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ [COLT]: 4, [BROCK]: 1 }));
    renderEditor();
    expect(await screen.findByRole('button', { name: 'Colt, tier A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Brock, tier D' })).toBeInTheDocument();
    // El borrador reemplaza todo: Shelly no estaba ubicada en él.
    expect(screen.getByRole('button', { name: 'Shelly, sin ubicar' })).toBeInTheDocument();
    expect(screen.getByText('A: 1')).toBeInTheDocument();
    expect(screen.getByText('S: 0')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument();
  });

  it('el borrador de otra temporada no se usa', async () => {
    window.sessionStorage.setItem('bw:tier-draft:1', JSON.stringify({ [COLT]: 4 }));
    renderEditor();
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Colt, sin ubicar' })).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it.each(['{nope', '[1,2]', '"hola"', 'null', '42'])('un borrador corrupto (%s) se ignora', async (raw) => {
    window.sessionStorage.setItem(DRAFT_KEY, raw);
    renderEditor();
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Shelly, tier S' })).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('del borrador se descartan los ids desconocidos y los tiers inválidos', async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ [COLT]: 4, 99999999: 5, [BULL]: 9, [BROCK]: 'S', abc: 3, [SHELLY]: 2.5 }),
    );
    renderEditor([]);
    expect(await screen.findByRole('button', { name: 'Colt, tier A' })).toBeInTheDocument();
    for (const name of ['Bull', 'Brock', 'Shelly']) {
      expect(screen.getByRole('button', { name: `${name}, sin ubicar` })).toBeInTheDocument();
    }
    expect(screen.getByText('Sin ubicar: 3')).toBeInTheDocument();
  });

  it('con menos de 10 ubicados muestra la nota, pero se puede guardar igual', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: true });
    renderEditor();
    expect(screen.getByText('Ubica al menos 10 brawlers para que tu voto cuente')).toBeInTheDocument();
    await choose(user, 'Colt, sin ubicar', 'D');
    await user.click(save());
    expect(saveTierList).toHaveBeenCalledTimes(1);
  });

  it('con 10 o más ubicados no muestra la nota', () => {
    const many: EditorBrawler[] = Array.from({ length: 10 }, (_, i) => ({
      id: 16000000 + i,
      name: `Brawler ${String(i).padStart(2, '0')}`,
      imageUrl: null,
      color: null,
    }));
    renderEditor(
      many.map((b) => ({ brawlerId: b.id, tier: 3 })),
      many,
    );
    expect(screen.queryByText('Ubica al menos 10 brawlers para que tu voto cuente')).not.toBeInTheDocument();
    expect(screen.getByText('B: 10')).toBeInTheDocument();
  });

  it('si la acción se rechaza (sin red) muestra el error y "Guardar" vuelve a estar disponible', async () => {
    const user = userEvent.setup();
    saveTierList.mockRejectedValue(new Error('Failed to fetch'));
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
    expect(save()).toBeEnabled();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('sin temporada abierta lo dice', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: false, code: 'NO_ACTIVE_SEASON' });
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay una temporada abierta para votar');
  });

  it('un brawler que la API no acepta (INVALID_PARAM) no habla de tags', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: false, code: 'INVALID_PARAM' });
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    await user.click(save());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos guardar tu tier list');
    expect(alert).not.toHaveTextContent('tag');
  });

  it('con el límite de guardados muestra la espera y bloquea "Guardar" con cuenta regresiva', async () => {
    const user = userEvent.setup();
    saveTierList.mockResolvedValue({ ok: false, code: 'RATE_LIMITED', retryAfter: 2 });
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    vi.useFakeTimers();
    try {
      await act(async () => {
        save().click();
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Vas muy rápido');
      const button = screen.getByRole('button', { name: 'Guardar en 2 s' });
      expect(button).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('button', { name: 'Guardar en 1 s' })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(save()).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('un segundo clic mientras guarda no manda dos veces', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    saveTierList.mockReturnValue(new Promise((r) => (resolve = r)));
    renderEditor();
    await choose(user, 'Colt, sin ubicar', 'A');
    const button = save();
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(saveTierList).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Tu tier list se guardó');
  });
});

describe('página /tierlist/editar', () => {
  const MINE: MyTierList = { season: SEASON, votes: [{ brawlerId: BULL, tier: 4 }] };

  function setup(session: unknown = { enabled: true, user: USER }) {
    getSession.mockResolvedValue(session);
    getMyTierList.mockResolvedValue({ data: MINE, meta: META });
    getBrawlers.mockResolvedValue({ data: CATALOG, meta: META });
  }

  it('sin sesión redirige al login con next=/tierlist/editar', async () => {
    setup({ enabled: true, user: null });
    await expect(TierEditPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/auth/discord?next=/tierlist/editar');
    expect(getMyTierList).not.toHaveBeenCalled();
  });

  it('Comunidad deshabilitada → aviso, sin redirigir ni pedir la lista', async () => {
    setup({ enabled: false, user: null });
    render(await TierEditPage());
    expect(screen.getByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
    expect(redirect).not.toHaveBeenCalled();
    expect(getMyTierList).not.toHaveBeenCalled();
  });

  it('sin temporada abierta → estado vacío', async () => {
    setup();
    getMyTierList.mockRejectedValue(new ApiError('NO_ACTIVE_SEASON', 'No hay temporada', { status: 409 }));
    render(await TierEditPage());
    expect(screen.getByText('No hay una temporada abierta para votar')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('si la sesión venció entre medio, redirige al login', async () => {
    setup();
    getMyTierList.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Inicia sesión', { status: 401 }));
    await expect(TierEditPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/auth/discord?next=/tierlist/editar');
  });

  it('DB_UNAVAILABLE → "Comunidad no está disponible ahora"', async () => {
    setup();
    getMyTierList.mockRejectedValue(new ApiError('DB_UNAVAILABLE', 'sin base', { status: 503 }));
    render(await TierEditPage());
    expect(screen.getByRole('alert')).toHaveTextContent('Comunidad no está disponible ahora');
  });

  it('otros errores se muestran con ApiErrorView', async () => {
    setup();
    getBrawlers.mockRejectedValue(new ApiError('NETWORK', 'No hay conexión', { status: 0 }));
    render(await TierEditPage());
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión');
  });

  it('con sesión y temporada: el editor con los votos guardados', async () => {
    setup();
    render(await TierEditPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Armar mi tier list' })).toBeInTheDocument();
    expect(screen.getByText(/Temporada 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bull, tier A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shelly, sin ubicar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver la tier list de la comunidad' })).toHaveAttribute('href', '/tierlist');
    expect(save()).toBeDisabled();
  });
});
