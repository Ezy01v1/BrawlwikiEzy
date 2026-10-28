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
  it('un deadlock y luego éxito → reintenta una vez y devuelve el resultado', async () => {
    const f = failing([deadlock()]);
    await expect(retryOnLockConflict(f.fn)).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
  });

  it('dos conflictos seguidos → relanza el segundo, sin un tercer intento', async () => {
    const second = Object.assign(new Error('Lock wait timeout'), { errno: 1205 });
    const f = failing([deadlock(), second]);
    await expect(retryOnLockConflict(f.fn)).rejects.toBe(second);
    expect(f.calls()).toBe(2);
  });

  it('otro error → no reintenta', async () => {
    const err = new Error('ECONNREFUSED');
    const f = failing([err]);
    await expect(retryOnLockConflict(f.fn)).rejects.toBe(err);
    expect(f.calls()).toBe(1);
  });

  it('conflicto envuelto en cause (como DrizzleQueryError) también se reintenta', async () => {
    const f = failing([new Error('Failed query', { cause: deadlock() })]);
    await expect(retryOnLockConflict(f.fn)).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
  });
});
