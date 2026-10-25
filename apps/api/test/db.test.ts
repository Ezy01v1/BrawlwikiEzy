import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { favorites, seasons, sessions, tierVotes, users } from '../src/db/schema';
import { withTestDb } from './db-helpers';

const testDb = withTestDb();

describe.skipIf(!testDb)('base de datos (MySQL)', () => {
  beforeEach(() => testDb!.reset());

  it('borrar un usuario elimina en cascada sesiones, favoritos y votos', async () => {
    const { db } = testDb!;
    const [u] = await db.insert(users).values({ discordId: '123', username: 'Ana' }).$returningId();
    const [s] = await db.insert(seasons).values({ name: 'T1', startedAt: new Date() }).$returningId();
    await db.insert(sessions).values({ id: 'a'.repeat(64), userId: u!.id, expiresAt: new Date(Date.now() + 1e6) });
    await db.insert(favorites).values({ userId: u!.id, kind: 'player', tag: 'ABC', name: 'Ana' });
    await db.insert(tierVotes).values({ seasonId: s!.id, userId: u!.id, brawlerId: 16000000, tier: 5 });

    await db.delete(users).where(eq(users.id, u!.id));

    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(await db.select().from(favorites)).toHaveLength(0);
    expect(await db.select().from(tierVotes)).toHaveLength(0);
    expect(await db.select().from(seasons)).toHaveLength(1);
  });
});
