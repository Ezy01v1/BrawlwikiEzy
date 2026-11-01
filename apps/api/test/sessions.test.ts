import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSessionStore,
  dbCall,
  generateToken,
  hashToken,
  nextExpiry,
  purgeExpiredSessions,
  SESSION_PURGE_INTERVAL_MS,
  SESSION_TTL_MS,
  startSessionPurge,
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

describe('startSessionPurge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const logger = () => ({ info: vi.fn(), warn: vi.fn() });

  it('purga al arrancar y después cada SESSION_PURGE_INTERVAL_MS (6 h); stop corta el ciclo', async () => {
    expect(SESSION_PURGE_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    const purge = vi.fn(async () => 0);
    const stop = startSessionPurge({ purge, logger: logger() });
    await vi.advanceTimersByTimeAsync(0);
    expect(purge).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SESSION_PURGE_INTERVAL_MS);
    expect(purge).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(SESSION_PURGE_INTERVAL_MS * 3);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('loguea cuántas borró solo si borró alguna; un fallo se loguea y no corta el ciclo', async () => {
    const log = logger();
    const purge = vi.fn<() => Promise<number>>().mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('caído')).mockResolvedValueOnce(3);
    const stop = startSessionPurge({ purge, logger: log, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(log.info).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(log.warn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(log.info).toHaveBeenCalledWith({ deleted: 3 }, expect.any(String));
    stop();
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

  it('purgeExpiredSessions borra solo las vencidas y devuelve cuántas', async () => {
    clock = Date.UTC(2026, 0, 1);
    const store = createSessionStore(testDb!.db, now);
    const id = await newUser();
    await store.create(id);
    await store.create(id);
    clock += 20 * DAY;
    const fresh = await store.create(id);
    clock += 11 * DAY; // las dos primeras vencieron (31 días), la última no
    expect(await purgeExpiredSessions(testDb!.db, now)).toBe(2);
    const rows = await testDb!.db.select().from(sessions);
    expect(rows.map((r) => r.id)).toEqual([hashToken(fresh)]);
    expect(await purgeExpiredSessions(testDb!.db, now)).toBe(0);
  });
});
