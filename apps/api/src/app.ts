import type { Health } from '@brawlwiki/shared';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';

export interface AppDeps {
  logger: Logger;
  health: () => Health;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());

  app.get('/api/v1/health', (_req, res) => {
    sendData(res, { data: deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
