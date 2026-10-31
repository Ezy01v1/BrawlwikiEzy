/**
 * Deja vacía la base de los E2E de Comunidad (DROP + CREATE) antes de migrarla y de arrancar la API.
 * La corre el `command` del webServer de la API en playwright.config.ts (solo con TEST_DATABASE_URL), y no un
 * `globalSetup`: Playwright levanta los webServer antes del globalSetup.
 * Uso: `DATABASE_URL=mysql://…/bw_test_e2e node apps/web/e2e/prepare-db.ts` (Node 24 corre el TypeScript tal cual).
 */
import mysql from 'mysql2/promise';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('[e2e] falta DATABASE_URL');
  process.exit(1);
}

const url = new URL(raw);
const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
// Nunca borrar una base que no sea de tests (mismo prefijo que los permisos del usuario local de tests).
if (!/^bw_test_\w+$/.test(name)) {
  console.error(`[e2e] la base "${name}" no empieza con bw_test_: no se toca`);
  process.exit(1);
}

url.pathname = '/';
const conn = await mysql.createConnection(url.toString());
try {
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
} finally {
  await conn.end();
}
console.log(`[e2e] base ${name} lista para migrar`);
