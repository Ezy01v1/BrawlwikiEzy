import type { Health } from '@brawlwiki/shared';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';
import { createV1Router } from './routes/v1';
import type { RequestContext, Services } from './services';

export interface AppDeps {
  logger: Logger;
  health: () => Health | Promise<Health>;
  services?: Services;
  contextFor?: (req: Request) => RequestContext;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());

  app.get('/api/v1/health', async (_req, res) => {
    sendData(res, { data: await deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });
  if (deps.services) app.use('/api/v1', createV1Router(deps.services, deps.contextFor));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
