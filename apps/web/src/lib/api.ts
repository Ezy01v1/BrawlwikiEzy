import { ApiErrorBodySchema, envelopeSchema, type ErrorCode, type Meta } from '@brawlwiki/shared';
import type { z } from 'zod';

export const DEFAULT_API_URL = 'http://127.0.0.1:4000/api/v1';
export const API_TIMEOUT_MS = 6000;

export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfter?: number;
  readonly requestId?: string;

  constructor(code: ApiErrorCode, message: string, opts: { status: number; retryAfter?: number; requestId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = opts.status;
    if (opts.retryAfter !== undefined) this.retryAfter = opts.retryAfter;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
  }
}

export interface ApiResult<T> {
  data: T;
  meta: Meta;
}

export interface ApiGetOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  forwardedFor?: string | null;
  timeoutMs?: number;
}

const UNEXPECTED = 'Respuesta inesperada del servidor.';

/** Solo para el servidor de Next: el navegador nunca llama a la API interna. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>, opts: ApiGetOptions = {}): Promise<ApiResult<T>> {
  const base = opts.baseUrl ?? process.env.API_INTERNAL_URL ?? DEFAULT_API_URL;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.forwardedFor) headers['X-Forwarded-For'] = opts.forwardedFor;

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('NETWORK', 'No pudimos conectar con el servidor de BrawlWiki.', { status: 0 });
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(body);
    if (!parsed.success) {
      console.error('[api] error con cuerpo inesperado', path, res.status);
      throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
    }
    const e = parsed.data.error;
    throw new ApiError(e.code, e.message, { status: res.status, retryAfter: e.retryAfter, requestId: e.requestId });
  }

  const parsed = envelopeSchema(schema).safeParse(body);
  if (!parsed.success) {
    console.error('[api] respuesta con forma inesperada', path, parsed.error.issues.slice(0, 3));
    throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
  }
  return parsed.data as ApiResult<T>;
}
