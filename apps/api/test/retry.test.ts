import { describe, expect, it } from 'vitest';
import { isLockConflict, retryOnLockConflict } from '../src/community/retry';

const deadlock = () => Object.assign(new Error('Deadlock found'), { errno: 1213, code: 'ER_LOCK_DEADLOCK' });

/** fn falsa que lanza los errores dados en orden y después devuelve 'ok'. */
function failing(errors: unknown[]) {
  let calls = 0;
  const fn = async () => {
    const err = errors[calls++];
    if (err !== undefined) throw err;
    return 'ok';
  };
  return { fn, calls: () => calls };
}

describe('isLockConflict', () => {
  it('reconoce 1213 y 1205 por errno o code, también dentro de cause', () => {
    expect(isLockConflict(deadlock())).toBe(true);
    expect(isLockConflict({ errno: 1205 })).toBe(true);
    expect(isLockConflict({ code: 'ER_LOCK_WAIT_TIMEOUT' })).toBe(true);
    expect(isLockConflict(new Error('Failed query', { cause: deadlock() }))).toBe(true);
    expect(isLockConflict(new Error('x', { cause: new Error('y', { cause: { errno: 1205 } }) }))).toBe(true);
    expect(isLockConflict(Object.assign(new Error('dup'), { errno: 1062, code: 'ER_DUP_ENTRY' }))).toBe(false);
    expect(isLockConflict(new Error('ECONNREFUSED'))).toBe(false);
    expect(isLockConflict(undefined)).toBe(false);
  });
});

describe('retryOnLockConflict', () => {
  /** sleep falso que registra las esperas; random fijo para que el jitter sea predecible. */
  function timers(random = () => 0.5) {
    const waits: number[] = [];
    return { waits, opts: { sleep: async (ms: number) => void waits.push(ms), random } };
  }

  it('un deadlock y luego éxito → reintenta una vez, tras esperar, y devuelve el resultado', async () => {
    const t = timers();
    const f = failing([deadlock()]);
    await expect(retryOnLockConflict(f.fn, t.opts)).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
    expect(t.waits).toEqual([60]);
  });

  it('tres conflictos y éxito en el tercer reintento', async () => {
    const t = timers();
    const timeout = Object.assign(new Error('Lock wait timeout'), { errno: 1205 });
    const f = failing([deadlock(), timeout, deadlock()]);
    await expect(retryOnLockConflict(f.fn, t.opts)).resolves.toBe('ok');
    expect(f.calls()).toBe(4);
    expect(t.waits).toHaveLength(3);
  });

  it('cuatro conflictos seguidos → relanza el último tras 3 reintentos', async () => {
    const t = timers();
    const last = Object.assign(new Error('Lock wait timeout'), { errno: 1205 });
    const f = failing([deadlock(), deadlock(), deadlock(), last]);
    await expect(retryOnLockConflict(f.fn, t.opts)).rejects.toBe(last);
    expect(f.calls()).toBe(4);
    expect(t.waits).toHaveLength(3);
  });

  it('la espera es aleatoria entre 20 y 100 ms', async () => {
    for (const [r, ms] of [
      [0, 20],
      [0.999999, 100],
    ] as const) {
      const t = timers(() => r);
      await retryOnLockConflict(failing([deadlock()]).fn, t.opts);
      expect(t.waits[0]).toBeCloseTo(ms, 0);
    }
  });

  it('otro error → no reintenta ni espera', async () => {
    const t = timers();
    const err = new Error('ECONNREFUSED');
    const f = failing([err]);
    await expect(retryOnLockConflict(f.fn, t.opts)).rejects.toBe(err);
    expect(f.calls()).toBe(1);
    expect(t.waits).toEqual([]);
  });

  it('conflicto envuelto en cause (como DrizzleQueryError) también se reintenta', async () => {
    const f = failing([new Error('Failed query', { cause: deadlock() })]);
    await expect(retryOnLockConflict(f.fn, timers().opts)).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
  });

  it('sin opciones usa un sleep real (corto)', async () => {
    const f = failing([deadlock()]);
    await expect(retryOnLockConflict(f.fn)).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
  });
});
