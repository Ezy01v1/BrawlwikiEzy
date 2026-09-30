import type { ErrorCode } from '@brawlwiki/shared';

const STATUS: Record<ErrorCode, number> = {
  INVALID_TAG: 400,
  INVALID_PARAM: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_MAINTENANCE: 503,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

const MESSAGES: Record<ErrorCode, string> = {
  INVALID_TAG: 'El tag no es válido. Los tags solo usan los caracteres 0289PYLQGRJCUV.',
  INVALID_PARAM: 'Parámetro inválido.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  RATE_LIMITED: 'Demasiadas solicitudes. Espera un momento.',
  UPSTREAM_RATE_LIMITED: 'Supercell nos pidió bajar el ritmo. Intenta en unos segundos.',
  UPSTREAM_MAINTENANCE: 'Brawl Stars está en mantenimiento. Vuelve en un rato.',
  UPSTREAM_UNAVAILABLE: 'No pudimos contactar a Supercell. Intenta de nuevo.',
  INTERNAL: 'Ocurrió un error inesperado.',
};

export const UPSTREAM_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_MAINTENANCE',
  'UPSTREAM_UNAVAILABLE',
]);

export function statusFor(code: ErrorCode): number {
  return STATUS[code];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string = MESSAGES[code],
    options: { retryAfter?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
