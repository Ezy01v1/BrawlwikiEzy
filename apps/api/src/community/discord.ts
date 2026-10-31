import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { dbCall } from './sessions';

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

export interface DiscordClient {
  authorizeUrl(state: string): string;
  exchange(code: string): Promise<DiscordProfile>;
}

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const ME_URL = 'https://discord.com/api/users/@me';
const TIMEOUT_MS = 8000;

export function createDiscordClient(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): DiscordClient {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    authorizeUrl(state) {
      const q = new URLSearchParams({
        client_id: opts.clientId,
        response_type: 'code',
        scope: 'identify',
        redirect_uri: opts.redirectUri,
        state,
      });
      return `${AUTHORIZE_URL}?${q}`;
    },

    async exchange(code) {
      const tokenRes = await doFetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: opts.redirectUri,
        }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!tokenRes.ok) throw new Error(`Discord token: HTTP ${tokenRes.status}`);
      const token = (await tokenRes.json()) as { access_token?: unknown };
      if (typeof token.access_token !== 'string') throw new Error('Discord token: respuesta sin access_token');

      // El token de Discord solo se usa aquí; nunca se guarda.
      const meRes = await doFetch(ME_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!meRes.ok) throw new Error(`Discord @me: HTTP ${meRes.status}`);
      const me = (await meRes.json()) as Record<string, unknown>;
      if (typeof me.id !== 'string' || typeof me.username !== 'string') throw new Error('Discord @me: perfil inválido');
      return {
        id: me.id,
        username: me.username,
        globalName: typeof me.global_name === 'string' ? me.global_name : null,
        avatar: typeof me.avatar === 'string' ? me.avatar : null,
      };
    },
  };
}

/** Inserta o actualiza el usuario por `discord_id`; devuelve su id. */
export async function upsertDiscordUser(db: Db, profile: DiscordProfile): Promise<number> {
  const values = {
    username: (profile.globalName ?? profile.username).slice(0, 64),
    avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
  };
  return dbCall(async () => {
    await db
      .insert(users)
      .values({ discordId: profile.id, ...values })
      .onDuplicateKeyUpdate({ set: values });
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.discordId, profile.id)).limit(1);
    if (!row) throw new Error('upsertDiscordUser: usuario no encontrado tras el upsert');
    return row.id;
  });
}
