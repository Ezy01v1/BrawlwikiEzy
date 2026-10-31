import { proxyLogout } from '@/lib/auth-proxy';

export async function POST(request: Request): Promise<Response> {
  return proxyLogout(request);
}
