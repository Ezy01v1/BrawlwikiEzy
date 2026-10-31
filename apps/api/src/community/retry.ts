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

export const LOCK_RETRIES = 3;
const MIN_WAIT_MS = 20;
const MAX_WAIT_MS = 100;

export interface RetryOptions {
  /** Para tests: espera falsa. */
  sleep?: (ms: number) => Promise<void>;
  /** Para tests: jitter predecible (0 ≤ r < 1). */
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Repite la transacción completa hasta 3 veces ante un deadlock o lock wait timeout, con una espera aleatoria
 * de 20 a 100 ms entre intentos (dos guardados de usuarios distintos pueden chocar en los gap locks del
 * DELETE+INSERT; reintentarlos al mismo tiempo los haría chocar de nuevo). Otros errores se relanzan.
 */
export async function retryOnLockConflict<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const sleep = opts.sleep ?? realSleep;
  const random = opts.random ?? Math.random;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= LOCK_RETRIES || !isLockConflict(err)) throw err;
      await sleep(MIN_WAIT_MS + random() * (MAX_WAIT_MS - MIN_WAIT_MS));
    }
  }
}
