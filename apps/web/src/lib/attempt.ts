import { ApiError } from './api';

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: ApiError };

/** Convierte un ApiError en valor para renderizarlo en línea (Next oculta los mensajes de errores lanzados en producción). */
export async function attempt<T>(p: Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e };
    throw e;
  }
}
