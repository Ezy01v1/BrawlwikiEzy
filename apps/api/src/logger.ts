import pino, { type DestinationStream, type Logger } from 'pino';

export type { Logger };

const REDACT = [
  'authorization',
  '*.authorization',
  'headers.authorization',
  'req.headers.authorization',
  'apiKey',
  '*.apiKey',
  // Segunda barrera (los serializers de abajo ya los quitan): sesión, OAuth y cookies que pone la API.
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  const options = { level, redact: { paths: REDACT, censor: '[redacted]' } };
  return destination ? pino(options, destination) : pino(options);
}

/** Sin la query: en el callback de Discord lleva `code` y `state`, y en el redirect a Discord, el `state`. */
export function withoutQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

type Headers = Record<string, unknown>;

/** Copia de los headers sin los que nombra `drop` (en minúsculas, como los dan Node y pino). */
function omitHeaders(headers: unknown, drop: string[]): Headers | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  return Object.fromEntries(Object.entries(headers as Headers).filter(([k]) => !drop.includes(k.toLowerCase())));
}

/**
 * Serializers de pino-http (reciben lo ya serializado por pino-std-serializers). Nunca van a los logs:
 * la query (`code`, `state`, `next`), la cookie de sesión/OAuth ni los `Set-Cookie` de la respuesta.
 */
export const httpSerializers = {
  req(req: Record<string, unknown>) {
    return {
      id: req.id,
      method: req.method,
      url: withoutQuery(req.url),
      headers: omitHeaders(req.headers, ['cookie', 'authorization']),
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    };
  },
  res(res: Record<string, unknown>) {
    const headers = omitHeaders(res.headers, ['set-cookie']);
    if (headers && 'location' in headers) headers.location = withoutQuery(headers.location);
    return { statusCode: res.statusCode, headers };
  },
};
