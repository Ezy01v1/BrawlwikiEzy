# BrawlWiki Comunidad — Spec de diseño

**Fecha:** 2026-10-19
**Estado:** Secciones 1–3 aprobadas en brainstorming. Las secciones 7 (errores) y 8 (testing) se escribieron directo en la spec y se revisan acá.
**Alcance:** Sub-proyecto 2 de 4. Parte de la v1 (`docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`).

---

## 1. Resumen

Comunidad suma cuentas de usuario y una tier list votable. Los dos pilares pesan igual:

- **Cuentas:** login con Discord, favoritos sincronizados entre dispositivos y un tag de jugador vinculado ("Mi perfil").
- **Tier list:** cada usuario arma la suya (S/A/B/C/D). La tier list de la comunidad es el promedio. Hay una por temporada: el admin abre una nueva cuando hay cambios de balance y las anteriores quedan como historial.

Sin sesión, el sitio funciona igual que en la v1, y la tier list de la comunidad se puede ver sin cuenta.

### Fuera de alcance

| Feature | Motivo |
|---|---|
| Perfiles públicos (`/u/nombre`) | No se pidió; se puede sumar después sin cambiar el modelo |
| Login con Google o con email y contraseña | Discord alcanza para esta comunidad |
| Verificar que el tag vinculado sea del usuario | Supercell no ofrece una forma de probarlo |
| Comentarios, moderación, reportes | No hay contenido escrito por usuarios |
| Tier list por modo de juego | Divide los votos entre muchas listas |
| Arrastrar y soltar en el editor | Frágil en táctil y poco accesible; se puede agregar en escritorio |

## 2. Arquitectura

Todo vive en la API Express existente (`apps/api`), que suma MySQL 8 con Drizzle ORM. Next (`apps/web`) sigue siendo solo la vista: el navegador nunca habla con la API, y Next reenvía la cookie `bw_session` igual que hoy reenvía `X-Forwarded-For`. Al compartir el dominio no hace falta CORS.

```
navegador ──HTTPS──> Nginx ──> Next (127.0.0.1:3000) ──cookie + XFF──> API (127.0.0.1:4000) ──> MySQL
                                                                                            ├──> Redis / memoria (caché)
                                                                                            └──> Supercell, Discord
```

- **Drizzle:** el esquema vive en `apps/api/src/db/schema.ts` y las migraciones SQL en `apps/api/drizzle/`, versionadas en git. Se aplican con `npm run db:migrate -w @brawlwiki/api`.
- **Conexión:** `mysql2` con un pool de 10 conexiones. Si MySQL no está disponible, la API arranca igual: las rutas de la v1 funcionan y las de Comunidad responden `503 DB_UNAVAILABLE`. `/health` suma `db: "ok" | "down" | "disabled"`.
- **Sin `DATABASE_URL`** la API arranca en modo v1, sin Comunidad (`db: "disabled"`), y la web oculta el login. Así el deploy actual no se rompe.

## 3. Modelo de datos

```
users
  id            BIGINT PK autoincrement
  discord_id    VARCHAR(32) UNIQUE
  username      VARCHAR(64)        -- nombre visible de Discord; se refresca en cada login
  avatar_url    VARCHAR(255) NULL
  player_tag    VARCHAR(16) NULL   -- normalizado (sin #, mayúsculas)
  created_at    DATETIME

sessions
  id            CHAR(64) PK        -- SHA-256 del token; el token real solo vive en la cookie
  user_id       FK users ON DELETE CASCADE
  expires_at    DATETIME           -- 30 días; se extiende al usarla si quedan < 15
  created_at    DATETIME

favorites
  user_id       FK users ON DELETE CASCADE
  kind          ENUM('player','club')
  tag           VARCHAR(16)
  name          VARCHAR(64)
  created_at    DATETIME
  PK (user_id, kind, tag)

seasons
  id            INT PK autoincrement
  name          VARCHAR(64)
  started_at    DATETIME
  ended_at      DATETIME NULL      -- NULL = activa; como máximo una

tier_votes
  season_id     FK seasons
  user_id       FK users ON DELETE CASCADE
  brawler_id    INT                -- id de Supercell; no hay tabla de brawlers
  tier          TINYINT            -- S=5, A=4, B=3, C=2, D=1
  updated_at    DATETIME
  PK (season_id, user_id, brawler_id)
```

- **Una sola temporada activa:** `POST /seasons` cierra la activa y abre la nueva en la misma transacción.
- **Guardar la tier list** reemplaza, en una transacción, todas las filas del usuario en la temporada activa.
- **Promedio de la comunidad:** `AVG(tier)` y `COUNT(*)` por `brawler_id`. Cortes fijos: S ≥ 4.5, A ≥ 3.5, B ≥ 2.5, C ≥ 1.5 y D por debajo. Con menos de 5 votos el brawler queda en "Pocos votos", sin tier. Solo cuentan los usuarios que ubicaron al menos 10 brawlers.
- **Caché:** la tier list de la comunidad se cachea 5 minutos con la caché existente (Redis o memoria). Guardar un voto o abrir una temporada la invalida. Las temporadas cerradas se cachean 24 horas.
- **Brawlers válidos:** un voto por un id que no está en la lista de brawlers (la cacheada de Supercell) se rechaza con `400 INVALID_PARAM`. Un brawler nuevo aparece en el editor sin ubicar.
- **Borrar la cuenta** elimina en cascada sesiones, favoritos y votos.

## 4. Login y sesiones

1. **Inicio:** `GET /auth/discord?next=/ruta` genera un `state` aleatorio y lo guarda en una cookie `httpOnly` de 10 minutos, junto con `next`. Después redirige a Discord con `scope=identify`.
2. **Callback:** `GET /auth/discord/callback?code&state` compara el `state` con la cookie (si no coincide, es un posible CSRF en el login), canjea el `code`, pide `/users/@me`, hace upsert del usuario y crea la sesión. El token de Discord se descarta: no se guarda.
3. **Cookie:** `bw_session` lleva 32 bytes aleatorios en base64url, con `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/` y `Max-Age` de 30 días.
4. **Redirección final:** a `next`, solo si es una ruta interna (empieza con `/` y no con `//`). Si no, a `/`. Así el login no se puede usar para redirigir a otro sitio.

**En cada request**, un middleware busca `sha256(token)` en `sessions`. Si la sesión es válida, carga `req.user` (con `isAdmin`). Las rutas 🔒 responden `401 UNAUTHENTICATED` sin sesión, y las 👑 responden `404 NOT_FOUND` si el usuario no es admin, para no revelar que existen.

**CSRF:** en `POST`, `PUT`, `PATCH` y `DELETE`, el header `Origin` tiene que coincidir con `PUBLIC_SITE_URL`. Si no, `403 FORBIDDEN`. Next reenvía el `Origin` del navegador.

**Cerrar sesión:** `POST /auth/logout` borra la fila de la sesión y expira la cookie.

**Modo mock:** con `AUTH_MOCK=1`, `/auth/discord` crea o usa el usuario `MockUser` (con `discord_id` `mock-1`) sin pasar por Discord. Con `AUTH_MOCK_ADMIN=1`, ese usuario es admin. La API se niega a arrancar si `AUTH_MOCK=1` y `NODE_ENV=production`.

**Variables nuevas** (`apps/api/.env`): `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `PUBLIC_SITE_URL`, `ADMIN_DISCORD_IDS` (ids separados por coma), `AUTH_MOCK` y `AUTH_MOCK_ADMIN`. El redirect de Discord es `${PUBLIC_SITE_URL}/auth/discord/callback`.

## 5. Contrato de la API (`/api/v1`)

🔒 = requiere sesión. 👑 = solo admin. Las respuestas usan el envoltorio actual (`{ data, meta }` o `{ error }`), y los esquemas Zod viven en `packages/shared`.

| Método | Ruta | Respuesta / efecto |
|---|---|---|
| GET | `/auth/discord` · `/auth/discord/callback` | Redirecciones del login (sección 4) |
| POST | `/auth/logout` 🔒 | `204` |
| GET | `/me` | `{ user }` o `{ user: null }` (nunca `401`) |
| PATCH | `/me` 🔒 | `{ playerTag: string \| null }` → usuario actualizado. Tag inválido → `400 INVALID_TAG` |
| DELETE | `/me` 🔒 | Borra la cuenta y la cookie → `204` |
| GET | `/me/favorites` 🔒 | `[{ kind, tag, name, createdAt }]` |
| PUT | `/me/favorites/:kind/:tag` 🔒 | `{ name }` → `204`, idempotente |
| DELETE | `/me/favorites/:kind/:tag` 🔒 | `204`, idempotente |
| POST | `/me/favorites/import` 🔒 | `{ items: [...] }` (como máximo 100) → unión sin pisar nada → `{ imported: n }` |
| GET | `/tierlist?season=<id>` | `{ season, voters, rows: [{ brawlerId, tier \| null, average, votes }] }`. Sin temporadas → `404 NOT_FOUND` |
| GET | `/tierlist/me` 🔒 | `{ season, votes: [{ brawlerId, tier }] }` de la temporada activa |
| PUT | `/tierlist/me` 🔒 | `{ votes: [{ brawlerId, tier: 1..5 }] }` → `204`. Sin temporada activa → `409 NO_ACTIVE_SEASON`. Límite de 10 por minuto por usuario |
| GET | `/seasons` | `[{ id, name, startedAt, endedAt }]`, la más nueva primero |
| POST | `/seasons` 🔒👑 | `{ name }` → la temporada nueva |

**Códigos de error nuevos** en `ErrorCodeSchema`: `UNAUTHENTICATED`, `FORBIDDEN`, `NO_ACTIVE_SEASON` y `DB_UNAVAILABLE`.

La documentación OpenAPI (`/api/v1/openapi.json`) incluye todas las rutas nuevas.

## 6. Frontend (`apps/web`)

### Rutas de Next

- **`/auth/discord`**, **`/auth/discord/callback`** y **`/auth/logout`:** route handlers que reenvían a la API, pasando el `Set-Cookie` y las redirecciones tal cual.
- Los Server Components leen la sesión con `getMe()`, que reenvía la cookie y se deduplica con `cache()`. Las acciones (votar, favoritos, tag) usan Server Actions que reenvían la cookie y el `Origin`.

### Páginas nuevas

- **`/tierlist`:** filas S/A/B/C/D más "Pocos votos", con la carta de cada brawler (`BrawlerCard`, como en el catálogo) y su número de votos, el total de votantes y un selector de temporada (`?season=`). Se ve sin cuenta. Con cuenta muestra "Armar mi tier list"; sin cuenta, "Entra con Discord para votar".
- **`/tierlist/editar`** 🔒: la grilla de brawlers. Al tocar una carta se abre un selector S/A/B/C/D/"Sin ubicar". Arriba hay un resumen por tier. "Guardar" envía todo de una vez, y si hay cambios sin guardar, avisa antes de salir. Sin sesión, redirige al login con `next=/tierlist/editar`. Sin temporada activa, muestra un estado vacío.
- **`/cuenta`** 🔒: el avatar y el nombre de Discord, el tag vinculado (con cambiar y quitar), cerrar sesión y borrar la cuenta. Borrar pide confirmación escribiendo "BORRAR".
- **`/admin`** 👑: un formulario para abrir una temporada nueva, con la lista de temporadas. Si el usuario no es admin, `notFound()`.

### Cambios en lo existente

- **Header:** "Entrar" o el avatar (que lleva a `/cuenta`). Si hay un tag vinculado, suma el acceso "Mi perfil". Con `db` deshabilitada en `/health`, no se muestra nada de esto.
- **Menú inferior:** "Clubes" se reemplaza por "Tier list" (sigue con 4 ítems). Clubes se mantiene accesible desde el perfil, la home y el header.
- **Favoritos:** sin sesión, `localStorage` como hoy. Con sesión, la API es la fuente de verdad. En el primer login, si hay favoritos locales, se importan y se muestra un aviso: "Subimos tus N favoritos a tu cuenta". Después se borran del `localStorage`. Los recientes siguen siendo locales.
- **Perfil de jugador:** botón "Este soy yo" (con sesión) para vincular el tag.
- **Home:** si hay un tag vinculado, un acceso "Mi perfil" arriba de la búsqueda.

## 7. Manejo de errores

| Situación | Experiencia |
|---|---|
| `401` en una página 🔒 | Redirige al login con `next` = la página actual |
| `401` en una acción (votar, favorito) | Aviso "Tu sesión venció" con el botón "Entrar con Discord"; no se pierde lo editado (el borrador de la tier list queda en `sessionStorage`) |
| `409 NO_ACTIVE_SEASON` | Estado vacío "No hay una temporada abierta para votar" |
| `503 DB_UNAVAILABLE` | `ErrorState` "Comunidad no está disponible ahora"; el resto del sitio sigue funcionando |
| Discord rechaza o cancela el login | Vuelve a la página de origen con el aviso "No se pudo iniciar sesión con Discord" |
| `state` inválido o vencido | Igual que el anterior; se registra con `warn` |
| `403 FORBIDDEN` (Origin) | `ErrorState` genérico; no debería pasar con un uso normal |
| Rate limit de votos | El `ErrorState` existente, con cuenta regresiva |

La caída de MySQL no afecta las rutas de la v1, que no lo usan.

## 8. Testing

- **Unit (Vitest):** cálculo de tiers (cortes, mínimo de votos, mínimo de 10 ubicados), validación de `next`, hash y vencimiento de sesiones, validación de votos (ids válidos, tiers del 1 al 5, duplicados), unión de favoritos al importar.
- **Integración de la API (supertest + MySQL real):** un servicio `mysql:8` en el CI y un MySQL local (Docker o instalado) en desarrollo. Cada suite crea un schema temporal y corre las migraciones. Si no hay `TEST_DATABASE_URL`, estos tests se omiten con un aviso, como los de Redis hoy. Cubren las rutas de la sección 5, el CSRF por `Origin`, la cascada al borrar la cuenta, el `409` sin temporada, el `404` para quien no es admin y la invalidación de la caché al votar.
- **Login con Discord:** el canje del `code` y `/users/@me` se prueban con un `fetch` falso, como el cliente de Supercell. El flujo real se prueba a mano una vez, con una app de Discord de desarrollo.
- **Web (Vitest + Testing Library):** el editor (seleccionar un tier, el resumen, el aviso de cambios sin guardar), el header con y sin sesión, el aviso de importación de favoritos.
- **E2E (Playwright):** con `AUTH_MOCK=1` y la base del CI: login → armar la tier list → guardar → verla en `/tierlist`; favoritos que sobreviven a recargar con sesión; vincular un tag → "Mi perfil"; cerrar sesión; `/admin` como admin abre una temporada. Más axe y la ausencia de scroll horizontal a 375 px en las páginas nuevas.

## 9. Configuración y operación

- **Desarrollo:** MySQL local más `npm run db:migrate -w @brawlwiki/api`. Sin MySQL, la API corre en modo v1.
- **CI:** se suma el servicio `mysql:8` al job de tests y al de E2E, con `TEST_DATABASE_URL` y `AUTH_MOCK=1`.
- **Deploy:** `deploy/README.md` suma la instalación de MySQL, la creación de un usuario con permisos solo sobre la base `brawlwiki`, `db:migrate` antes de `pm2 reload` y la app de Discord (redirect URI de producción).
- **Backups:** `mysqldump` diario por cron, con 7 días de retención. Se documenta en `deploy/README.md`.
- **Privacidad:** `/acerca` suma qué se guarda (id, nombre y avatar de Discord, tag vinculado, favoritos, votos), que no se guarda el email ni el token de Discord, y que borrar la cuenta lo elimina todo.

## 10. Riesgos y limitaciones

- **Votos falsos con cuentas de Discord descartables:** el mínimo de 5 votos y de 10 brawlers ubicados lo mitiga un poco. Si llega a ser un problema, se puede exigir una antigüedad mínima de la cuenta de Discord (el id la codifica).
- **Tag vinculado sin verificar:** cualquiera puede decir que es cualquier jugador. Solo afecta su propio "Mi perfil", porque no hay perfiles públicos.
- **MySQL es un punto nuevo de falla:** queda aislado; si cae, solo cae Comunidad (sección 7).
- **Brawlers nuevos:** aparecen sin ubicar y sin tier hasta que la gente los vote; no requiere acción.
