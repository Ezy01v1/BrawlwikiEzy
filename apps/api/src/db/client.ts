import { sql } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export type Db = MySql2Database<typeof schema>;

export function createDb(url: string): { db: Db; ping(): Promise<boolean>; close(): Promise<void> } {
  const pool = mysql.createPool({ uri: url, connectionLimit: 10 });
  const db = drizzle(pool, { schema, mode: 'default' });
  return {
    db,
    async ping() {
      try {
        await db.execute(sql`SELECT 1`);
        return true;
      } catch {
        return false;
      }
    },
    close: () => pool.end(),
  };
}
