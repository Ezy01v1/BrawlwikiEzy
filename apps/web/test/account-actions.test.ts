import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount, linkTag } from '@/app/cuenta/actions';
import { ApiError } from '@/lib/api';

const apiRequest = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
}));

const CTX = { forwardedFor: '198.51.100.9', cookie: 'bw_session=tok', origin: 'https://brawlwiki.test' };
vi.mock('@/lib/queries', () => ({ requestContext: async () => CTX }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const deleteCookie = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ delete: (...a: unknown[]) => deleteCookie(...a) }) }));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const USER = { id: 7, username: 'Ezy', avatarUrl: null, playerTag: '2PP', isAdmin: false };
const META = { source: 'fresh', fetchedAt: '2026-10-29T12:00:00.000Z', ageSeconds: 0 };

beforeEach(() => {
  apiRequest.mockReset();
  revalidatePath.mockReset();
  deleteCookie.mockReset();
  redirect.mockClear();
});

describe('linkTag', () => {
  it('normaliza el tag, llama a PATCH /me con cookie, origin y XFF, y revalida el layout', async () => {
    apiRequest.mockResolvedValue({ data: { user: USER }, meta: META });
    expect(await linkTag('#2pp')).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('PATCH', '/me', expect.anything(), {
      body: { playerTag: '2PP' },
      ...CTX,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('null desvincula', async () => {
    apiRequest.mockResolvedValue({ data: { user: { ...USER, playerTag: null } }, meta: META });
    expect(await linkTag(null)).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('PATCH', '/me', expect.anything(), { body: { playerTag: null }, ...CTX });
  });

  it('un tag inválido (o algo que no es texto) no llega a la API', async () => {
    expect(await linkTag('hola')).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(await linkTag(42 as unknown as string)).toEqual({ ok: false, code: 'INVALID_TAG' });
    expect(apiRequest).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('los errores de la API vuelven como código, sin lanzar', async () => {
    apiRequest.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Inicia sesión.', { status: 401 }));
    expect(await linkTag('2PP')).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    apiRequest.mockRejectedValue(new TypeError('boom'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await linkTag('2PP')).toEqual({ ok: false, code: 'INTERNAL' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  it('exige exactamente "BORRAR" en el servidor', async () => {
    expect(await deleteAccount('borrar')).toEqual({ ok: false, code: 'CONFIRM_MISMATCH' });
    expect(await deleteAccount(' BORRAR')).toEqual({ ok: false, code: 'CONFIRM_MISMATCH' });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('borra la cuenta, expira la cookie en el navegador y vuelve al inicio', async () => {
    apiRequest.mockResolvedValue(null);
    await expect(deleteAccount('BORRAR')).rejects.toThrow('NEXT_REDIRECT /');
    expect(apiRequest).toHaveBeenCalledWith('DELETE', '/me', null, CTX);
    expect(deleteCookie).toHaveBeenCalledWith(expect.objectContaining({ name: 'bw_session', path: '/' }));
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('si la API falla no toca la cookie ni redirige', async () => {
    apiRequest.mockRejectedValue(new ApiError('DB_UNAVAILABLE', 'Sin base.', { status: 503 }));
    expect(await deleteAccount('BORRAR')).toEqual({ ok: false, code: 'DB_UNAVAILABLE' });
    expect(deleteCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
