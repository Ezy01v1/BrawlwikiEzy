import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export function requestId(): RequestHandler {
  return (_req, res, next) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
