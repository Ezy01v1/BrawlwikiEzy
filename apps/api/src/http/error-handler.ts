import type { ApiErrorBody } from '@brawlwiki/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, isAppError } from '../errors';
import type { Logger } from '../logger';

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => next(new AppError('NOT_FOUND', 'Ruta no encontrada.'));
}

function isMalformedRequestError(err: unknown): boolean {
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (err as { statusCode?: unknown } | null)?.statusCode;
  return status === 400;
}

interface DbErrorInfo {
  code?: string;
  errno?: number;
  sqlState?: string;
  message?: string;
}

/**
 * Lo que se puede loguear de un fallo de DB: code/errno/sqlState de la cadena de `cause` (Drizzle envuelve el
 * error de mysql2) y el mensaje del error más interno solo si no viene del servidor MySQL ni de Drizzle: el de
 * Drizzle trae los `params` (hashes de sesión, tags, nombres) y los del servidor pueden citar valores.
 */
export function dbErrorInfo(err: unknown): DbErrorInfo {
  const info: DbErrorInfo = {};
  let innermost: { message?: unknown; sqlState?: unknown } | undefined;
  let e: unknown = err;
  for (let depth = 0; depth < 6 && typeof e === 'object' && e !== null; depth++) {
    const { code, errno, sqlState, cause } = e as { code?: unknown; errno?: unknown; sqlState?: unknown; cause?: unknown };
    if (info.code === undefined && typeof code === 'string') info.code = code;
    if (info.errno === undefined && typeof errno === 'number') info.errno = errno;
    if (info.sqlState === undefined && typeof sqlState === 'string') info.sqlState = sqlState;
    innermost = e as typeof innermost;
    e = cause;
  }
  const message = innermost?.message;
  if (
    typeof message === 'string' &&
    innermost?.sqlState === undefined &&
    info.sqlState === undefined &&
    !/^Failed query|params:/i.test(message)
  ) {
    info.message = message.slice(0, 200);
  }
  return info;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const requestId = String(res.locals.requestId ?? '');
    let appErr: AppError;
    if (isAppError(err)) {
      appErr = err;
      if (err.code === 'DB_UNAVAILABLE') {
        // dbCall convierte cualquier fallo en DB_UNAVAILABLE: sin este log, una DB caída no se vería.
        logger.warn({ requestId, db: dbErrorInfo(err.cause) }, 'base de datos no disponible');
      }
    } else if (isMalformedRequestError(err)) {
      appErr = new AppError('INVALID_PARAM');
    } else {
      appErr = new AppError('INTERNAL');
      logger.error({ err, requestId }, 'error no controlado');
    }

    const body: ApiErrorBody = {
      error: { code: appErr.code, message: appErr.message, requestId },
    };
    if (appErr.retryAfter !== undefined) {
      body.error.retryAfter = appErr.retryAfter;
      res.setHeader('Retry-After', String(appErr.retryAfter));
    }
    res.status(appErr.status).json(body);
  };
}
