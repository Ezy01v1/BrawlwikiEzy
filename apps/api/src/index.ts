import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { createApp } from './app';
import { createCachedFetch } from './cache/cached-fetch';
import { createMemoryCache } from './cache/memory';
import { createRedisCache } from './cache/redis';
import { loadConfig } from './config';
import { createHealth } from './health';
import { createLogger } from './logger';
import { createServices } from './services';
import { createSupercellClient } from './supercell/client';
import { createFixtureClient } from './supercell/fixtures';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const config = loadConfig();
const logger = createLogger(config.logLevel);

async function initRedis() {
  if (!config.redisUrl) return null;
  const client = createRedisCache(config.redisUrl, (err) => logger.warn({ err }, 'Redis error'));
  try {
    await client.client.connect();
    return client;
  } catch (err) {
    logger.warn({ err }, 'Redis no disponible, usando caché en memoria');
    void client.quit().catch(() => {});
    return null;
  }
}

const redis = await initRedis();
const cache = redis ?? createMemoryCache();
const supercell = config.supercellMock
  ? createFixtureClient()
  : createSupercellClient({ apiKey: config.supercellApiKey!, baseUrl: config.supercellApiBase, logger });
const { cachedFetch, isCoolingDown } = createCachedFetch({ cache, logger });

const app = createApp({
  logger,
  services: createServices({ supercell, cachedFetch }),
  health: createHealth({ cache, supercell, isCoolingDown }),
  rateLimit: {
    generalPerMinute: 60,
    upstreamPerMinute: 20,
    ...(redis
      ? {
          store: new RedisStore({
            prefix: 'rl:',
            sendCommand: (command: string, ...args: string[]) =>
              redis.client.call(command, ...args) as Promise<RedisReply>,
          }),
        }
      : {}),
  },
});

const server = app.listen(config.port, config.host, (err?: Error) => {
  if (err) {
    logger.fatal({ err }, `No se pudo escuchar en ${config.host}:${config.port}`);
    process.exit(1);
    return;
  }
  logger.info(
    { url: `http://${config.host}:${config.port}/api/v1`, cache: cache.kind, supercell: supercell.mode },
    'BrawlWiki API lista',
  );
});

function shutdown() {
  server.close(() => {
    redis?.quit().catch(() => {});
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
