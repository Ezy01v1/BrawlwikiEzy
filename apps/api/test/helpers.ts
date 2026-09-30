export type FakeResponse =
  | { status: number; body?: unknown; text?: string; headers?: Record<string, string> }
  | Error;

export function fakeFetch(responses: FakeResponse[] | ((url: string) => FakeResponse)) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const r = typeof responses === 'function' ? responses(url) : responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    const payload = r.text ?? JSON.stringify(r.body ?? {});
    return new Response(payload, {
      status: r.status,
      headers: { 'content-type': 'application/json', ...r.headers },
    });
  }) as typeof fetch;
  return { impl, calls };
}
