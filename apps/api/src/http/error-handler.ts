import type { ApiErrorBody } from '@brawlwiki/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, isAppError } from '../errors';
import type { Logger } from '../logger';

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => next(new AppError('NOT_FOUND', 'Ruta no encontrada.'));
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const requestId = String(res.locals.requestId ?? '');
    const appErr = isAppError(err) ? err : new AppError('INTERNAL');
    if (!isAppError(err)) logger.error({ err, requestId }, 'error no controlado');

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
