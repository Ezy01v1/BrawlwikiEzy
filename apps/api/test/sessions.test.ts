import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionStore,
  dbCall,
  generateToken,
  hashToken,
  nextExpiry,
  SESSION_TTL_MS,
} from '../src/community/sessions';
import { sessions, users } from '../src/db/schema';
import { AppError } from '../src/errors';
import { withTestDb } from './db-helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('helpers de sesión', () => {
  it('genera tokens de 32 bytes en base64url, distintos', () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });

  it('hashToken es sha256 en hex', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('nextExpiry: null si quedan >= 15 días; si quedan menos, now + 30 días', () => {
    const now = 1_000_000_000_000;
    expect(nextExpiry(now + 20 * DAY, now)).toBeNull();
    expect(nextExpiry(now + 15 * DAY, now)).toBeNull();
    expect(nextExpiry(now + 10 * DAY, now)).toBe(now + 30 * DAY);
    expect(SESSION_TTL_MS).toBe(30 * DAY);
  });

  it('dbCall convierte fallos en DB_UNAVAILABLE y deja pasar AppError', async () => {
    await expect(dbCall(async () => 7)).resolves.toBe(7);
    await expect(
      dbCall(async () => {
        throw new Error('ECONNREFUSED');
      }),
    ).rejects.toMatchObject({ code: 'DB_UNAVAILABLE' });
    await expect(
      dbCall(async () => {
        throw new AppError('NOT_FOUND');
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

const testDb = withTestDb();

describe.skipIf(!testDb)('SessionStore (MySQL)', () => {
  beforeEach(() => testDb!.reset());
  let clock = Date.UTC(2026, 0, 1);
  const now = () => clock;

  async function newUser() {
    const [u] = await testDb!.db.insert(users).values({ discordId: '42', username: 'Ana' }).$returningId();
    return u!.id;
  }

  it('un token creado se resuelve al usuario y se guarda hasheado', async () => {
    clock = Date.UTC(2026, 0, 1);
    const store = createSessionStore(testDb!.db, now);
    const id = await newUser();
    const token = await store.create(id);
    expect(await store.resolve(token)).toEqual({ id, discordId: '42', username: 'Ana', avatarUrl: null, playerTag: null });
    const rows = await testDb!.db.select().from(sessions);
    expect(rows[0]!.id).toBe(hashToken(token));
  });

  it('tras 31 días devuelve null', async () => {
    clock = Date.UTC(2026, 0, 1);
    const store = createSessionStore(testDb!.db, now);
    const token = await store.create(await newUser());
    clock += 31 * DAY;
    expect(await store.resolve(token)).toBeNull();
  });

  it('con 10 días restantes extiende expires_at a 30 días', async () => {
    clock = Date.UTC(2026, 0, 1);
    const store = createSessionStore(testDb!.db, now);
    const token = await store.create(await newUser());
    clock += 20 * DAY;
    expect(await store.resolve(token)).not.toBeNull();
    const [row] = await testDb!.db.select().from(sessions).where(eq(sessions.id, hashToken(token)));
    expect(row!.expiresAt.getTime()).toBe(clock + 30 * DAY);
  });

  it('usuario borrado → null; destroy invalida', async () => {
    clock = Date.UTC(2026, 0, 1);
    const store = createSessionStore(testDb!.db, now);
    const id = await newUser();
    const t1 = await store.create(id);
    const t2 = await store.create(id);
    await store.destroy(t2);
    expect(await store.resolve(t2)).toBeNull();
    await testDb!.db.delete(users).where(eq(users.id, id));
    expect(await store.resolve(t1)).toBeNull();
    expect(await store.resolve('basura')).toBeNull();
  });
});
