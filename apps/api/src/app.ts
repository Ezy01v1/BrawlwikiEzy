import type { Health } from '@brawlwiki/shared';
import express, { type Express, type Request } from 'express';
import type { Store } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { createGeneralLimiter, createUpstreamGuard } from './http/rate-limit';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';
import { buildOpenApiDocument } from './openapi';
import { createV1Router } from './routes/v1';
import type { RequestContext, Services } from './services';

export interface AppDeps {
  logger: Logger;
  health: () => Health | Promise<Health>;
  services?: Services;
  contextFor?: (req: Request) => RequestContext;
  rateLimit?: { generalPerMinute: number; upstreamPerMinute: number; store?: Store };
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // Next.js (en 127.0.0.1) reenvía la IP real del usuario en X-Forwarded-For.
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());
  app.use(pinoHttp({ logger: deps.logger, genReqId: (_req, res) => String(res.getHeader('X-Request-Id')) }));

  let contextFor = deps.contextFor;
  if (deps.rateLimit) {
    app.use(createGeneralLimiter({ perMinute: deps.rateLimit.generalPerMinute, store: deps.rateLimit.store }));
    const guard = createUpstreamGuard({ perMinute: deps.rateLimit.upstreamPerMinute });
    contextFor ??= (req) => ({ beforeUpstream: () => guard.check(req.ip ?? 'unknown') });
  }

  app.get('/api/v1/health', async (_req, res) => {
    sendData(res, { data: await deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(buildOpenApiDocument());
  });
  if (deps.services) app.use('/api/v1', createV1Router(deps.services, contextFor));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
