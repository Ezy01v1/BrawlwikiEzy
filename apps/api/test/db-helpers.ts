import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll } from 'vitest';
import { createDb, type Db } from '../src/db/client';
import { migrationsFolder } from '../src/db/migrate';

const TABLES = ['tier_votes', 'favorites', 'sessions', 'seasons', 'users'];

/** Crea un schema `bw_test_<random>` migrado; null si no hay TEST_DATABASE_URL. */
export function withTestDb(): { db: Db; reset(): Promise<void> } | null {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) return null;
  const schema = `bw_test_${randomBytes(6).toString('hex')}`;
  const url = new URL(baseUrl);
  url.pathname = `/${schema}`;
  let handle: ReturnType<typeof createDb> | undefined;

  beforeAll(async () => {
    const admin = await mysql.createConnection(baseUrl);
    await admin.query(`CREATE DATABASE \`${schema}\``);
    await admin.end();
    handle = createDb(url.toString());
    await migrate(handle.db, { migrationsFolder });
  });

  afterAll(async () => {
    await handle?.close();
    const admin = await mysql.createConnection(baseUrl);
    await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin.end();
  });

  return {
    get db() {
      if (!handle) throw new Error('withTestDb: la base aún no está lista');
      return handle.db;
    },
    async reset() {
      const conn = await mysql.createConnection(url.toString());
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.end();
    },
  };
}
