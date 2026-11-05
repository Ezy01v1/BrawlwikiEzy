import { sql } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export type Db = MySql2Database<typeof schema>;

export function createDb(url: string): { db: Db; ping(): Promise<boolean>; close(): Promise<void> } {
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    // DATETIME se lee y escribe como UTC; la expiración de sesiones depende de esto.
    timezone: 'Z',
  });
  // `timezone: 'Z'` solo cubre lo que convierte el driver; los DEFAULT CURRENT_TIMESTAMP los calcula MySQL en la
  // zona de la sesión. Cada conexión nueva queda en UTC antes de su primera consulta (mysql2 encola en orden).
  // `pool.pool` es el pool de callbacks: su evento entrega la conexión cruda, y así lo dicen también los tipos.
  pool.pool.on('connection', (conn) => {
    // Con callback: sin él, un error se emitiría como 'error' sin listener y tiraría el proceso. Si falla, la
    // conexión está rota y la consulta siguiente dará DB_UNAVAILABLE.
    conn.query("SET time_zone = '+00:00'", () => {});
  });
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
