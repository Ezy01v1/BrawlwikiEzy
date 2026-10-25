import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb } from './client';

export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Uso: `npm run db:migrate -w @brawlwiki/api` (aplica las migraciones a DATABASE_URL). */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.loadEnvFile();
  } catch {
    // Sin .env: se usan las variables del entorno.
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }
  const { db, close } = createDb(url);
  await migrate(db, { migrationsFolder });
  await close();
  console.log('Migraciones aplicadas');
}
