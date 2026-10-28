/** ER_LOCK_DEADLOCK (1213) y ER_LOCK_WAIT_TIMEOUT (1205): MySQL deshizo la transacción y se puede repetir. */
const LOCK_ERRNOS = new Set([1213, 1205]);
const LOCK_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

/** Busca el error de mysql2 en el error o en su cadena de `cause` (Drizzle lo envuelve). */
export function isLockConflict(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 5 && typeof e === 'object' && e !== null; depth++) {
    const { errno, code, cause } = e as { errno?: unknown; code?: unknown; cause?: unknown };
    if (typeof errno === 'number' && LOCK_ERRNOS.has(errno)) return true;
    if (typeof code === 'string' && LOCK_CODES.has(code)) return true;
    e = cause;
  }
  return false;
}

/** Repite la transacción completa una sola vez ante un deadlock o lock wait timeout; si no, relanza. */
export async function retryOnLockConflict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isLockConflict(err)) throw err;
    return fn();
  }
}
