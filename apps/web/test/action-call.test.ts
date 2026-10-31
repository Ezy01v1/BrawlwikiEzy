import { redirect } from 'next/navigation';
import { describe, expect, it } from 'vitest';
import { callAction } from '@/lib/action-call';

describe('callAction', () => {
  it('devuelve el resultado de la acción tal cual', async () => {
    expect(await callAction(async () => ({ ok: true as const }))).toEqual({ ok: true });
  });

  it('una acción rechazada (sin red, o "Failed to find Server Action") se vuelve NETWORK', async () => {
    expect(await callAction(() => Promise.reject(new TypeError('Failed to fetch')))).toEqual({
      ok: false,
      code: 'NETWORK',
    });
  });

  it('relanza la redirección de Next: la maneja su RedirectBoundary, no es un error', async () => {
    let redirectError: unknown;
    try {
      redirect('/');
    } catch (e) {
      redirectError = e;
    }
    await expect(callAction(() => Promise.reject(redirectError))).rejects.toBe(redirectError);
  });
});
