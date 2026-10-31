import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addFavorite, importFavorites, removeFavorite } from '@/app/favorites/actions';
import { ApiError } from '@/lib/api';
import { getFavorites } from '@/lib/queries';

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

const CTX = { forwardedFor: '198.51.100.9', cookie: 'bw_session=tok', origin: expect.any(String) };
const META = { source: 'fresh', fetchedAt: '2026-10-29T12:00:00.000Z', ageSeconds: 0 };

beforeEach(() => {
  apiRequest.mockReset();
  revalidatePath.mockReset();
});

describe('addFavorite', () => {
  it('normaliza el tag, hace PUT con nombre, cookie, origin y XFF, y revalida la home', async () => {
    apiRequest.mockResolvedValue(null);
    expect(await addFavorite('player', '#2pp', '  EzyPlayer ')).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('PUT', '/me/favorites/player/2PP', null, {
      body: { name: 'EzyPlayer' },
      ...CTX,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('sin nombre usa #TAG; un nombre largo se corta a 64', async () => {
    apiRequest.mockResolvedValue(null);
    await addFavorite('club', '2YPLQ', '   ');
    expect(apiRequest.mock.calls[0]![3]).toMatchObject({ body: { name: '#2YPLQ' } });
    await addFavorite('club', '2YPLQ', 'x'.repeat(80));
    expect((apiRequest.mock.calls[1]![3] as { body: { name: string } }).body.name).toHaveLength(64);
    await addFavorite('club', '2YPLQ', 42 as unknown as string);
    expect(apiRequest.mock.calls[2]![3]).toMatchObject({ body: { name: '#2YPLQ' } });
  });

  it('kind o tag inválidos no llegan a la API', async () => {
    expect(await addFavorite('brawler' as 'player', '2PP', 'x')).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(await addFavorite('player', 'hola!', 'x')).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(await addFavorite('player', 42 as unknown as string, 'x')).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(apiRequest).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('los errores de la API vuelven como código, sin lanzar ni revalidar', async () => {
    apiRequest.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Inicia sesión.', { status: 401 }));
    expect(await addFavorite('player', '2PP', 'x')).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    apiRequest.mockRejectedValue(new TypeError('boom'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await addFavorite('player', '2PP', 'x')).toEqual({ ok: false, code: 'INTERNAL' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('removeFavorite', () => {
  it('hace DELETE y revalida la home', async () => {
    apiRequest.mockResolvedValue(null);
    expect(await removeFavorite('club', '2yplq')).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('DELETE', '/me/favorites/club/2YPLQ', null, CTX);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('valida kind y tag', async () => {
    expect(await removeFavorite('x' as 'club', '2PP')).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(await removeFavorite('club', '')).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

describe('importFavorites', () => {
  it('manda los ítems normalizados y devuelve cuántos eran nuevos', async () => {
    apiRequest.mockResolvedValue({ data: { imported: 2 }, meta: META });
    expect(
      await importFavorites([
        { kind: 'player', tag: '#2pp', name: ' Ezy ' },
        { kind: 'club', tag: '2YPLQ', name: '' },
      ]),
    ).toEqual({ ok: true, imported: 2 });
    expect(apiRequest).toHaveBeenCalledWith('POST', '/me/favorites/import', expect.anything(), {
      body: {
        items: [
          { kind: 'player', tag: '2PP', name: 'Ezy' },
          { kind: 'club', tag: '2YPLQ', name: '' },
        ],
      },
      ...CTX,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('si no había nada nuevo no revalida', async () => {
    apiRequest.mockResolvedValue({ data: { imported: 0 }, meta: META });
    expect(await importFavorites([{ kind: 'player', tag: '2PP', name: 'x' }])).toEqual({ ok: true, imported: 0 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('una lista vacía no llama a la API', async () => {
    expect(await importFavorites([])).toEqual({ ok: true, imported: 0 });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('valida en el servidor: forma, máximo 100, kind y tag', async () => {
    const item = { kind: 'player' as const, tag: '2PP', name: 'x' };
    expect(await importFavorites('nope' as unknown as [])).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(await importFavorites(Array.from({ length: 101 }, () => item))).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(await importFavorites([item, { ...item, kind: 'x' as 'player' }])).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(await importFavorites([item, { ...item, tag: 'hola!' }])).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(await importFavorites([null as unknown as typeof item])).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('los errores de la API vuelven como código', async () => {
    apiRequest.mockRejectedValue(new ApiError('INVALID_TAG', 'Tag inválido.', { status: 400 }));
    expect(await importFavorites([{ kind: 'player', tag: '2PP', name: 'x' }])).toEqual({
      ok: false,
      code: 'INVALID_TAG',
    });
  });
});

describe('getFavorites (query)', () => {
  it('pide GET /me/favorites con la cookie y devuelve la lista', async () => {
    const list = [{ kind: 'club', tag: '2YPLQ', name: 'Los Cracks', createdAt: '2026-10-29T12:00:00.000Z' }];
    apiRequest.mockResolvedValue({ data: list, meta: META });
    expect(await getFavorites()).toEqual(list);
    expect(apiRequest).toHaveBeenCalledWith(
      'GET',
      '/me/favorites',
      expect.anything(),
      expect.objectContaining({ cookie: 'bw_session=tok', forwardedFor: '198.51.100.9' }),
    );
  });

  it('si la API falla devuelve [] (no tira la home ni el perfil)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiRequest.mockRejectedValue(new ApiError('DB_UNAVAILABLE', 'Sin base.', { status: 503 }));
    expect(await getFavorites()).toEqual([]);
    apiRequest.mockRejectedValue(new ApiError('NETWORK', 'Sin conexión.', { status: 0 }));
    expect(await getFavorites()).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
