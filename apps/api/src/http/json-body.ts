import express, { type RequestHandler } from 'express';
import { AppError } from '../errors';

/** express.json con límite; un cuerpo demasiado grande (413) se informa como 400 INVALID_PARAM. */
export function jsonBody(limit: string): RequestHandler {
  const parser = express.json({ limit });
  return (req, res, next) =>
    parser(req, res, (err?: unknown) => {
      const type = (err as { type?: unknown } | null | undefined)?.type;
      next(type === 'entity.too.large' ? new AppError('INVALID_PARAM', 'Cuerpo demasiado grande.') : err);
    });
}
