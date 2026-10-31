import type { ApiErrorCode } from './api';

/** Palabra que hay que escribir para borrar la cuenta; la acción la vuelve a comprobar en el servidor. */
export const DELETE_CONFIRM_WORD = 'BORRAR';
export const SESSION_COOKIE = 'bw_session';
export const COMMUNITY_UNAVAILABLE = 'Comunidad no está disponible ahora';
export const NO_ACTIVE_SEASON_MESSAGE = 'No hay una temporada abierta para votar';
export const INVALID_TAG_MESSAGE =
  'Ese tag no es válido. Los tags solo usan 0289PYLQGRJCUV (la letra O se toma como cero).';

export type ActionErrorCode = ApiErrorCode | 'CONFIRM_MISMATCH';
/** Las Server Actions devuelven el error como dato: en producción Next oculta el mensaje de lo que se lanza. */
export type ActionResult = { ok: true } | { ok: false; code: ActionErrorCode };

/** Link al login que vuelve a `path`. La `/` queda legible: es válida en una query. */
export function loginHref(path: string): string {
  return `/auth/discord?next=${encodeURIComponent(path).replace(/%2F/gi, '/')}`;
}

export function profileHref(tag: string): string {
  return `/jugador/${tag}`;
}

export function actionErrorMessage(code: ActionErrorCode): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Tu sesión venció';
    case 'INVALID_TAG':
    case 'INVALID_PARAM':
      return INVALID_TAG_MESSAGE;
    case 'DB_UNAVAILABLE':
    case 'NETWORK':
      return COMMUNITY_UNAVAILABLE;
    case 'RATE_LIMITED':
      return 'Vas muy rápido. Espera un momento y vuelve a intentarlo.';
    case 'NO_ACTIVE_SEASON':
      return NO_ACTIVE_SEASON_MESSAGE;
    case 'FORBIDDEN':
      return 'No tienes permiso para hacer esto.';
    case 'CONFIRM_MISMATCH':
      return `Escribe ${DELETE_CONFIRM_WORD} para confirmar.`;
    default:
      return 'Algo salió mal. Inténtalo de nuevo.';
  }
}
