import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTierList } from '@/app/tierlist/actions';
import { ApiError } from '@/lib/api';
import { getMyTierList } from '@/lib/queries';

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
const META = { source: 'fresh', fetchedAt: '2026-10-30T12:00:00.000Z', ageSeconds: 0 };

beforeEach(() => {
  apiRequest.mockReset();
  revalidatePath.mockReset();
});

describe('saveTierList', () => {
  it('hace PUT /tierlist/me con los votos, cookie, origin y XFF, y revalida /tierlist', async () => {
    apiRequest.mockResolvedValue(null);
    const votes = [
      { brawlerId: 16000000, tier: 5 },
      { brawlerId: 16000001, tier: 1 },
    ];
    expect(await saveTierList(votes)).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('PUT', '/tierlist/me', null, { body: { votes }, ...CTX });
    expect(revalidatePath).toHaveBeenCalledWith('/tierlist');
  });

  it('una lista vacía es válida (borra los votos)', async () => {
    apiRequest.mockResolvedValue(null);
    expect(await saveTierList([])).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith('PUT', '/tierlist/me', null, { body: { votes: [] }, ...CTX });
  });

  it('descarta campos de más en cada voto', async () => {
    apiRequest.mockResolvedValue(null);
    await saveTierList([{ brawlerId: 16000000, tier: 5, extra: 'x' } as never]);
    expect(apiRequest.mock.calls[0]![3]).toMatchObject({ body: { votes: [{ brawlerId: 16000000, tier: 5 }] } });
    expect((apiRequest.mock.calls[0]![3] as { body: { votes: object[] } }).body.votes[0]).not.toHaveProperty('extra');
  });

  it.each([
    ['no es una lista', 'nope'],
    ['un voto null', [null]],
    ['tier 0', [{ brawlerId: 1, tier: 0 }]],
    ['tier 6', [{ brawlerId: 1, tier: 6 }]],
    ['tier decimal', [{ brawlerId: 1, tier: 2.5 }]],
    ['brawlerId negativo', [{ brawlerId: -1, tier: 3 }]],
    ['brawlerId texto', [{ brawlerId: '1', tier: 3 }]],
    ['duplicados', [{ brawlerId: 1, tier: 3 }, { brawlerId: 1, tier: 4 }]],
    ['más de 200', Array.from({ length: 201 }, (_, i) => ({ brawlerId: i + 1, tier: 3 }))],
  ])('inválido (%s) → INVALID_PARAM sin llamar a la API', async (_label, votes) => {
    expect(await saveTierList(votes as never)).toEqual({ ok: false, code: 'INVALID_PARAM' });
    expect(apiRequest).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('los errores de la API vuelven como código, sin lanzar ni revalidar', async () => {
    const vote = [{ brawlerId: 16000000, tier: 5 }];
    apiRequest.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Inicia sesión.', { status: 401 }));
    expect(await saveTierList(vote)).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    apiRequest.mockRejectedValue(new ApiError('NO_ACTIVE_SEASON', 'Sin temporada.', { status: 409 }));
    expect(await saveTierList(vote)).toEqual({ ok: false, code: 'NO_ACTIVE_SEASON' });
    apiRequest.mockRejectedValue(new TypeError('boom'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await saveTierList(vote)).toEqual({ ok: false, code: 'INTERNAL' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('RATE_LIMITED trae los segundos de espera', async () => {
    apiRequest.mockRejectedValue(new ApiError('RATE_LIMITED', 'Espera.', { status: 429, retryAfter: 42 }));
    expect(await saveTierList([])).toEqual({ ok: false, code: 'RATE_LIMITED', retryAfter: 42 });
  });
});

describe('getMyTierList (query)', () => {
  it('pide GET /tierlist/me con la cookie y XFF', async () => {
    const mine = {
      season: { id: 2, name: 'Temporada 2', startedAt: '2026-10-01T00:00:00.000Z', endedAt: null },
      votes: [{ brawlerId: 16000000, tier: 5 }],
    };
    apiRequest.mockResolvedValue({ data: mine, meta: META });
    expect((await getMyTierList()).data).toEqual(mine);
    expect(apiRequest).toHaveBeenCalledWith(
      'GET',
      '/tierlist/me',
      expect.anything(),
      expect.objectContaining({ cookie: 'bw_session=tok', forwardedFor: '198.51.100.9' }),
    );
  });

  it('los errores se propagan como ApiError (la página decide)', async () => {
    apiRequest.mockRejectedValue(new ApiError('NO_ACTIVE_SEASON', 'Sin temporada.', { status: 409 }));
    await expect(getMyTierList()).rejects.toMatchObject({ code: 'NO_ACTIVE_SEASON' });
  });
});
