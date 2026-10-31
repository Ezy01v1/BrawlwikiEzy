try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // Sin apps/api/.env: se usan las variables del entorno.
}
