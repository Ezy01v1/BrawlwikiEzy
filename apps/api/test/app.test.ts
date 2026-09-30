import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/errors';
import { errorHandler } from '../src/http/error-handler';
import { requestId } from '../src/http/request-id';
import { createLogger } from '../src/logger';

const logger = createLogger('silent');

describe('app base', () => {
  it('GET /api/v1/health responde con envoltorio y headers', async () => {
    const app = createApp({ logger, health: () => ({ status: 'ok', cache: 'memory', supercell: 'mock' }) });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', cache: 'memory', supercell: 'mock' });
    expect(res.body.meta.source).toBe('fresh');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-cache-status']).toBe('MISS');
  });

  it('ruta desconocida → 404 NOT_FOUND con requestId del header', async () => {
    const app = createApp({ logger, health: () => ({ status: 'ok', cache: 'memory', supercell: 'ok' }) });
    const res = await request(app).get('/api/v1/nada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('errores inesperados → 500 INTERNAL sin filtrar el mensaje original', async () => {
    const app = express();
    app.use(requestId());
    app.get('/boom', () => {
      throw new Error('secreto interno');
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('secreto interno');
  });

  it('AppError con retryAfter agrega el header Retry-After', async () => {
    const app = express();
    app.use(requestId());
    app.get('/lento', () => {
      throw new AppError('RATE_LIMITED', undefined, { retryAfter: 30 });
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/lento');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('30');
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 30 });
  });
});
