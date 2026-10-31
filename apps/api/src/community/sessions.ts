import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import { AppError, isAppError } from '../errors';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;
/** Si a la sesión le quedan menos de esto, se extiende a SESSION_TTL_MS. */
export const SESSION_EXTEND_BELOW_MS = 15 * DAY_MS;

export interface SessionUser {
  id: number;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  playerTag: string | null;
}

export interface SessionStore {
  create(userId: number): Promise<string>;
  resolve(token: string): Promise<SessionUser | null>;
  destroy(token: string): Promise<void>;
}

/** 32 bytes aleatorios en base64url. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `sessions.id` = sha256(token) en hex; el token en claro nunca se guarda. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Nueva expiración (epoch ms) si hay que extender la sesión; null si no. */
export function nextExpiry(expiresAt: number, now: number): number | null {
  return expiresAt - now < SESSION_EXTEND_BELOW_MS ? now + SESSION_TTL_MS : null;
}

/** Ejecuta una operación de DB; cualquier fallo que no sea AppError → DB_UNAVAILABLE. */
export async function dbCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isAppError(err)) throw err;
    throw new AppError('DB_UNAVAILABLE', undefined, { cause: err });
  }
}

export function createSessionStore(db: Db, now: () => number = Date.now): SessionStore {
  return {
    async create(userId) {
      const token = generateToken();
      await dbCall(() =>
        db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: new Date(now() + SESSION_TTL_MS) }),
      );
      return token;
    },

    async resolve(token) {
      const id = hashToken(token);
      const [row] = await dbCall(() =>
        db
          .select({
            expiresAt: sessions.expiresAt,
            id: users.id,
            discordId: users.discordId,
            username: users.username,
            avatarUrl: users.avatarUrl,
            playerTag: users.playerTag,
          })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(eq(sessions.id, id))
          .limit(1),
      );
      if (!row) return null;
      const t = now();
      const expiresAt = row.expiresAt.getTime();
      if (expiresAt <= t) {
        await dbCall(() => db.delete(sessions).where(eq(sessions.id, id)));
        return null;
      }
      const extended = nextExpiry(expiresAt, t);
      if (extended !== null) {
        await dbCall(() => db.update(sessions).set({ expiresAt: new Date(extended) }).where(eq(sessions.id, id)));
      }
      const { expiresAt: _e, ...user } = row;
      return user;
    },

    async destroy(token) {
      await dbCall(() => db.delete(sessions).where(eq(sessions.id, hashToken(token))));
    },
  };
}
