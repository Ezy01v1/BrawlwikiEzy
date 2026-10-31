# BrawlWiki

Fan page no oficial de Brawl Stars. **Este material es no oficial y no está avalado por Supercell.**

## Requisitos

- Node 24+
- Una API key de https://developer.brawlstars.com registrada con tu IP pública (opcional si usas el modo fixtures)
- MySQL 8 (opcional): solo para Comunidad (cuentas, favoritos en la cuenta y tier list). Sin MySQL la API corre como la v1

## Arranque

```bash
npm install
cp apps/api/.env.example apps/api/.env   # y pega tu key en SUPERCELL_API_KEY
npm run dev                              # API en :4000 y web en http://localhost:3200
```

Sin key, o si cambió tu IP: pon `SUPERCELL_MOCK=1` en `apps/api/.env`.

La web solo habla con la API desde el servidor de Next (`API_INTERNAL_URL`, por defecto `http://127.0.0.1:4000/api/v1`). Para cambiarlo, copia `apps/web/.env.example` a `apps/web/.env.local`.

| Tag de fixtures | Qué simula |
|---|---|
| `2PP` | Jugador con club (`2YPLQ`) |
| `8QU` | Jugador sin club y sin partidas |
| `RRRR` | Supercell responde 429 (activa 10 s de cooldown en toda la API) |
| `LLLL` | Mantenimiento |
| `GGGG` | Respuesta lenta (4 s) |

## Comunidad (opcional)

Con `DATABASE_URL` en `apps/api/.env` la API suma cuentas con Discord, favoritos en la cuenta y la tier list. Sin esa variable (o si MySQL no responde) todo lo demás sigue igual y la web oculta el login.

```bash
# En MySQL: CREATE DATABASE brawlwiki CHARACTER SET utf8mb4;  (y un usuario con permisos sobre ella)
# En apps/api/.env: DATABASE_URL=mysql://usuario:contraseña@127.0.0.1:3306/brawlwiki y AUTH_MOCK=1
npm run db:migrate -w @brawlwiki/api     # crea o actualiza las tablas; correrlo después de cada pull con migraciones nuevas
```

| Variable (`apps/api/.env`) | Para qué |
|---|---|
| `DATABASE_URL` | MySQL de Comunidad. Vacía = API sin Comunidad (modo v1) |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | App de Discord para el login (obligatorias con `DATABASE_URL`, salvo con `AUTH_MOCK=1`) |
| `PUBLIC_SITE_URL` | URL pública de la web (por defecto `http://localhost:3200`; se usa solo su origin). En producción con `DATABASE_URL` es obligatoria y `https`. Arma el redirect de Discord (`/auth/discord/callback`) y es el único `Origin` aceptado en los POST/PUT/PATCH/DELETE |
| `ADMIN_DISCORD_IDS` | Ids de Discord de los administradores, separados por coma (pueden abrir temporadas en `/admin`) |
| `AUTH_MOCK`, `AUTH_MOCK_ADMIN` | `1` = login falso con `MockUser`, sin Discord (y admin con `AUTH_MOCK_ADMIN=1`). Solo desarrollo y tests: la API no arranca con `AUTH_MOCK=1` y `NODE_ENV=production` |
| `TEST_DATABASE_URL` | Solo tests: servidor MySQL **sin base** (ej. `mysql://bw_test:CONTRASEÑA@127.0.0.1:3306`) |

En la web, `NEXT_PUBLIC_SITE_URL` (`apps/web/.env.local`, por defecto `http://localhost:3200`) tiene que coincidir con `PUBLIC_SITE_URL`; si no, la API responde 403 a las acciones.

**Tests con MySQL.** Sin `TEST_DATABASE_URL`, los tests de la API que usan la base y los E2E de Comunidad se omiten con un aviso. Para correrlos, crea un usuario que solo pueda tocar bases `bw_test_*` (los tests crean y borran las suyas) y exporta la variable antes de `npm test` o `npm run e2e`:

```sql
CREATE USER 'bw_test'@'localhost' IDENTIFIED BY 'ELIGE_UNA_CONTRASEÑA';
GRANT ALL PRIVILEGES ON `bw\_test\_%`.* TO 'bw_test'@'localhost';
```

```bash
TEST_DATABASE_URL='mysql://bw_test:ELIGE_UNA_CONTRASEÑA@127.0.0.1:3306' npm test
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web juntas (también `npm run dev:api` y `npm run dev:web`) |
| `npm test` | Tests unitarios de todos los paquetes |
| `npm run typecheck` | Chequeo de tipos |
| `npm run e2e` | Playwright + axe. Levanta su propia API con fixtures (:4100) y un build de producción de la web (:3100). La primera vez: `npx playwright install chromium`. Con `TEST_DATABASE_URL` también corre `community.spec.ts`: borra, crea y migra la base `bw_test_e2e` y arranca la API con `AUTH_MOCK=1` y `AUTH_MOCK_ADMIN=1` |
| `npm run db:migrate -w @brawlwiki/api` | Aplica las migraciones de `apps/api/drizzle` a `DATABASE_URL` |
| `npm run db:generate -w @brawlwiki/api` | Genera una migración nueva tras cambiar `apps/api/src/db/schema.ts` |
| `npm run meta:import -w @brawlwiki/api -- <ruta absoluta a brawlers.json>` | Actualiza rareza y clase de los brawlers. El JSON se descarga desde el navegador en https://api.brawlapi.com/v1/brawlers |

- `npm run e2e` deja en `apps/web/.next` un build con `NEXT_PUBLIC_SITE_URL=http://localhost:3100`; antes de desplegar, correr `npm run build -w @brawlwiki/web` con las variables de producción.
- Los metadatos se importaron el 2026-10-16 (109 brawlers). Los brawlers nuevos no tendrán rareza ni clase hasta volver a correr `meta:import`.

## Páginas

| Ruta | Qué muestra |
|---|---|
| `/` | Búsqueda, favoritos, recientes y eventos activos |
| `/jugador/[tag]` | Perfil con resumen, brawlers y partidas |
| `/club/[tag]` | Club con estadísticas y miembros |
| `/clubes/comparar?a=&b=` | Búsqueda de clubes y comparador lado a lado |
| `/rankings?tipo=&region=&brawler=` | Top de jugadores, clubes o por brawler, global o por país |
| `/brawlers?q=&rareza=&clase=` | Catálogo con búsqueda y filtros |
| `/brawlers/[id]` | Detalle con gadgets, habilidades estelares y mejores jugadores |
| `/tierlist?season=` | Tier list de la comunidad (S a D y "Pocos votos") con selector de temporada |
| `/tierlist/editar` | Editor de la tier list propia (con sesión) |
| `/cuenta` | Cuenta: tag vinculado, cerrar sesión y borrar la cuenta (con sesión) |
| `/admin` | Abrir temporadas (solo administradores; a los demás les responde 404) |
| `/acerca` | Origen de los datos, privacidad, qué guarda una cuenta y aviso legal |

## Rendimiento

Medido con Lighthouse 13 (móvil) contra un build de producción y la API en modo fixtures. El spec pide LCP < 2.5 s (el umbral "bueno" de Google; hasta el 2026-10-15 pedía 1.5 s), CLS < 0.05 y TBT < 200 ms en `/` y `/jugador/[tag]`.

| Página | Performance | FCP | LCP simulado | LCP con throttling real | CLS | TBT |
|---|---|---|---|---|---|---|
| `/` | 96 | 1.0 s | 2.67 s | 1.8 s | 0.022 | 70–94 ms |
| `/jugador/2PP` | 95 | 1.0 s | 2.88 s | 2.7–2.9 s | 0.000 | 107–142 ms |

Medido el 2026-10-15, dos corridas por página. "Simulado" es el modo por defecto de Lighthouse (Lantern); "throttling real" es `--throttling-method=devtools`. Desde esa fecha el CSS va dentro del HTML (`experimental.inlineCss`), lo que bajó el primer pintado con throttling real de ~2.7 s a ~1.9 s.

El LCP simulado queda unas décimas por encima de 2.5 s y es un artefacto del simulador: Lantern supone que el LCP espera a todos los scripts pedidos antes que él, es decir, a React y Next (~115 KB gzip). En un navegador real con la CPU 4x más lenta, el elemento LCP (un párrafo de texto renderizado en el servidor) se pinta en el primer frame, a ~0.6 s, y no se vuelve a reportar después. Bajar el número simulado exigiría quitar React del camino crítico. En `/jugador/[tag]` el LCP con throttling real lo marca el footer, que llega después del contenido que se transmite con streaming.

Deploy en un VPS (PM2 + Nginx): [`deploy/README.md`](deploy/README.md).

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md` y, para Comunidad, `docs/superpowers/specs/2026-10-19-brawlwiki-comunidad-design.md`.
