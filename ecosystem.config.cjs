// PM2: `pm2 start ecosystem.config.cjs` desde la raíz del repo, después de `npm ci` y del build de la web.
// Las variables secretas (SUPERCELL_API_KEY, REDIS_URL) van en apps/api/.env, no acá.
// Comunidad (también en apps/api/.env; ver deploy/README.md): DATABASE_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
// PUBLIC_SITE_URL y ADMIN_DISCORD_IDS. Nunca AUTH_MOCK/AUTH_MOCK_ADMIN: con NODE_ENV=production la API no arranca.
// Antes de `pm2 reload`: `npm run db:migrate -w @brawlwiki/api`. La web toma NEXT_PUBLIC_SITE_URL del build, no de acá.
module.exports = {
  apps: [
    {
      name: 'brawlwiki-api',
      cwd: './apps/api',
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4000', LOG_LEVEL: 'info' },
      max_memory_restart: '300M',
      kill_timeout: 6000, // la API cierra conexiones en hasta 5 s al recibir SIGTERM
    },
    {
      name: 'brawlwiki-web',
      cwd: './apps/web',
      script: '../../node_modules/next/dist/bin/next', // npm workspaces sube next a la raíz
      args: 'start -H 127.0.0.1 -p 3000',
      env: { NODE_ENV: 'production', API_INTERNAL_URL: 'http://127.0.0.1:4000/api/v1' },
      max_memory_restart: '500M',
    },
  ],
};
