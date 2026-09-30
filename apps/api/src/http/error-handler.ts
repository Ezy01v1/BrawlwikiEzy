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

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const requestId = String(res.locals.requestId ?? '');
    let appErr: AppError;
    if (isAppError(err)) {
      appErr = err;
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
