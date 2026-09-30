import pino, { type DestinationStream, type Logger } from 'pino';

export type { Logger };

const REDACT = [
  'authorization',
  '*.authorization',
  'headers.authorization',
  'req.headers.authorization',
  'apiKey',
  '*.apiKey',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  const options = { level, redact: { paths: REDACT, censor: '[redacted]' } };
  return destination ? pino(options, destination) : pino(options);
}
