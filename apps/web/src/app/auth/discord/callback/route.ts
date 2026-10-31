import { proxyLoginRedirect } from '@/lib/auth-proxy';

export async function GET(request: Request): Promise<Response> {
  return proxyLoginRedirect(request, '/auth/discord/callback');
}
