import { describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn(async (..._args: unknown[]) => ({ data: {}, meta: {} }));
vi.mock('@/lib/api', () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));

let headerMap: Map<string, string>;
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k.toLowerCase()) ?? null }),
}));

describe('forwardedFor (a través de getPlayer)', () => {
  it('con x-forwarded-for, se pasa tal cual', async () => {
    const { getPlayer } = await import('@/lib/queries');
    headerMap = new Map([['x-forwarded-for', '203.0.113.5']]);
    await getPlayer('TAGFF1');
    const opts = apiGet.mock.calls.at(-1)![2] as unknown as { forwardedFor: string | null };
    expect(opts.forwardedFor).toBe('203.0.113.5');
  });

  it('sin x-forwarded-for pero con x-real-ip, usa ese valor', async () => {
    const { getPlayer } = await import('@/lib/queries');
    headerMap = new Map([['x-real-ip', '198.51.100.9']]);
    await getPlayer('TAGRI2');
    const opts = apiGet.mock.calls.at(-1)![2] as unknown as { forwardedFor: string | null };
    expect(opts.forwardedFor).toBe('198.51.100.9');
  });

  it('sin ninguno, se pasa null', async () => {
    const { getPlayer } = await import('@/lib/queries');
    headerMap = new Map();
    await getPlayer('TAGNONE3');
    const opts = apiGet.mock.calls.at(-1)![2] as unknown as { forwardedFor: string | null };
    expect(opts.forwardedFor).toBeNull();
  });
});
