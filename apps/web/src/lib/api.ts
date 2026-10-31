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

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions extends ApiGetOptions {
  /** Se manda como JSON. */
  body?: unknown;
  /** Header `Cookie` del navegador, tal cual (lleva `bw_session`). */
  cookie?: string | null;
  /** La API exige `Origin` = sitio público en POST/PUT/PATCH/DELETE. */
  origin?: string | null;
}

const UNEXPECTED = 'Respuesta inesperada del servidor.';

export function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? DEFAULT_API_URL;
}

/**
 * Solo para el servidor de Next: el navegador nunca llama a la API interna.
 * Devuelve `null` si la API responde 204 o si no se pide `schema`.
 */
export async function apiRequest<T>(
  method: ApiMethod,
  path: string,
  schema: z.ZodType<T> | null,
  opts: ApiRequestOptions = {},
): Promise<ApiResult<T> | null> {
  const base = opts.baseUrl ?? apiBaseUrl();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.forwardedFor) headers['X-Forwarded-For'] = opts.forwardedFor;
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.origin) headers.Origin = opts.origin;
  const hasBody = opts.body !== undefined;
  if (hasBody) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
      method,
      headers,
      ...(hasBody ? { body: JSON.stringify(opts.body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('NETWORK', 'No pudimos conectar con el servidor de BrawlWiki.', { status: 0 });
  }

  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      console.error('[api] error con cuerpo inesperado', path, res.status);
      throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
    }
    const e = parsed.data.error;
    throw new ApiError(e.code, e.message, { status: res.status, retryAfter: e.retryAfter, requestId: e.requestId });
  }

  if (res.status === 204 || schema === null) {
    await res.body?.cancel().catch(() => {});
    return null;
  }

  const parsed = envelopeSchema(schema).safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    console.error('[api] respuesta con forma inesperada', path, parsed.error.issues.slice(0, 3));
    throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
  }
  return parsed.data as ApiResult<T>;
}

/** GET con respuesta obligatoria (un 204 es un error del servidor). */
export async function apiGet<T>(path: string, schema: z.ZodType<T>, opts: ApiGetOptions = {}): Promise<ApiResult<T>> {
  const r = await apiRequest('GET', path, schema, opts);
  if (r === null) {
    console.error('[api] respuesta vacía inesperada', path);
    throw new ApiError('INTERNAL', UNEXPECTED, { status: 204 });
  }
  return r;
}
