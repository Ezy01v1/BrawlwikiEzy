import { unstable_rethrow } from 'next/navigation';

export type NetworkFailure = { ok: false; code: 'NETWORK' };

/**
 * Llama a una Server Action desde el cliente sin dejar escapar un rechazo. Las acciones devuelven sus errores como
 * dato, pero la llamada en sí puede rechazarse: sin red, o "Failed to find Server Action" en una pestaña abierta
 * desde antes de un deploy. Sin esto el componente queda trabado en `pending` y el error llega al error boundary.
 * Las redirecciones de Next (que también rechazan la promesa) se relanzan para que las maneje el router.
 */
export async function callAction<T>(action: () => Promise<T>): Promise<T | NetworkFailure> {
  try {
    return await action();
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, code: 'NETWORK' };
  }
}
