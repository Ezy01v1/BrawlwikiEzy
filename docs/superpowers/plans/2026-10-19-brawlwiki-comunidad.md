# BrawlWiki Comunidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuentas con login de Discord (favoritos sincronizados, tag vinculado) y una tier list de la comunidad por temporada.

**Architecture:** Todo en la API Express (`apps/api`) con MySQL 8 + Drizzle; sesiones opacas en la base (cookie `bw_session`, se guarda solo su SHA-256). Next (`apps/web`) sigue siendo solo vista: reenvía cookie, `Origin` y `X-Forwarded-For` a la API. Sin `DATABASE_URL`, la API corre en modo v1.

**Tech Stack:** Node 24, Express 5, Zod, `drizzle-orm` + `drizzle-kit` + `mysql2`, Next 16 (App Router, Server Actions), Vitest, supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-brawlwiki-comunidad-design.md`

## Global Constraints

- Rutas bajo `/api/v1`; envoltorio `{ data, meta }` / `{ error: { code, message, requestId } }` como en la v1 (`sendData`, `AppError`).
- Códigos de error nuevos: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NO_ACTIVE_SEASON` (409), `DB_UNAVAILABLE` (503).
- Cookie `bw_session`: 32 bytes aleatorios base64url, `HttpOnly`, `Secure` si `NODE_ENV=production`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 días; se extiende si quedan < 15 días. En la tabla `sessions.id` = `sha256(token)` en hex.
- Discord: `scope=identify`; redirect `${PUBLIC_SITE_URL}/auth/discord/callback`; el token de Discord nunca se guarda.
- CSRF: en POST/PUT/PATCH/DELETE el `Origin` debe ser igual a `PUBLIC_SITE_URL`, si no `403 FORBIDDEN`.
- `next` válido: empieza con `/` y no con `//` ni `/\`; si no, `/`.
- Tiers: S=5, A=4, B=3, C=2, D=1. Cortes S ≥ 4.5, A ≥ 3.5, B ≥ 2.5, C ≥ 1.5, D < 1.5. Menos de 5 votos → `tier: null` ("Pocos votos"). Solo cuentan usuarios con ≥ 10 brawlers ubicados.
- Caché de la tier list: 5 min (activa), 24 h (cerradas); se invalida al votar y al abrir temporada.
- `PUT /tierlist/me`: 10 por minuto por usuario. `POST /me/favorites/import`: máximo 100 ítems.
- `AUTH_MOCK=1` con `NODE_ENV=production` → la API no arranca. Usuario mock: `discord_id` `mock-1`, `username` `MockUser`; admin si `AUTH_MOCK_ADMIN=1`.
- Rutas 👑 responden `404 NOT_FOUND` a quien no es admin. `/me` nunca responde 401.
- Puertos de desarrollo: API 4000, web 3200; E2E 4100/3100. **El 3000 local no se toca.**
- Textos de la UI en español, tal como los fija la spec (sección 6 y 7).

## Review Focus

- **Dos pestañas guardando la tier list a la vez:** el reemplazo transaccional deja el estado de la última; nunca filas mezcladas. Test en Task 7.
- **Brawler desconocido o duplicado en `votes`:** `400 INVALID_PARAM` y nada se guarda. Test en Task 7.
- **Cookie de sesión vencida o de un usuario borrado:** se trata como sin sesión (`/me` → `{ user: null }`), no como error 500. Test en Task 3.
- **Importar favoritos que ya existen o con más de 100 ítems:** idempotente / `400 INVALID_PARAM`. Test en Task 6.
- **MySQL caído después de arrancar:** rutas de Comunidad → `503 DB_UNAVAILABLE`; rutas de la v1 siguen respondiendo. Test en Task 2.

---

### Task 1: Contrato compartido

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `apps/api/src/errors.ts` (STATUS y MESSAGES de los 4 códigos)
- Test: `packages/shared/test/community.test.ts`

**Interfaces:**
- Produces (en `@brawlwiki/shared`):
  - `TIER_VALUES = { S: 5, A: 4, B: 3, C: 2, D: 1 } as const`, `type TierLetter = 'S'|'A'|'B'|'C'|'D'`
  - `UserSchema = { id: number, username: string, avatarUrl: string|null, playerTag: string|null, isAdmin: boolean }`
  - `MeSchema = { user: UserSchema | null }`
  - `FavoriteSchema = { kind: 'player'|'club', tag: string, name: string, createdAt: string }`
  - `SeasonSchema = { id: number, name: string, startedAt: string, endedAt: string|null }`
  - `TierRowSchema = { brawlerId: number, tier: TierLetter|null, average: number, votes: number }`
  - `CommunityTierListSchema = { season: SeasonSchema, voters: number, rows: TierRowSchema[] }`
  - `MyTierListSchema = { season: SeasonSchema, votes: { brawlerId: number, tier: 1..5 }[] }`
  - `SaveTierListBodySchema = { votes: { brawlerId: int>0, tier: int 1..5 }[] }` (max 200, sin brawlerId repetidos vía `superRefine`)
  - `ImportFavoritesBodySchema = { items: { kind, tag, name }[] }` (max 100)
  - `HealthSchema` suma `db: 'ok'|'down'|'disabled'`

- [ ] **Step 1: Tests** — `SaveTierListBodySchema` rechaza `tier: 6`, `tier: 0` y un `brawlerId` repetido; `ImportFavoritesBodySchema` rechaza 101 ítems; `MeSchema` acepta `{ user: null }`; `ErrorCodeSchema` acepta los 4 códigos nuevos.
- [ ] **Step 2:** `npm test -w @brawlwiki/shared` → FAIL.
- [ ] **Step 3:** Implementar los esquemas y sumar los códigos a `ErrorCodeSchema`; en `errors.ts`, mensajes: `UNAUTHENTICATED` "Inicia sesión para continuar.", `FORBIDDEN` "No tienes permiso para hacer esto.", `NO_ACTIVE_SEASON` "No hay una temporada abierta para votar.", `DB_UNAVAILABLE` "Comunidad no está disponible ahora. Intenta en un rato."
- [ ] **Step 4:** `npm test && npm run typecheck` → PASS (los tests existentes de health que comparan el objeto completo se actualizan con `db: 'disabled'`).
- [ ] **Step 5:** Commit `feat(shared): contrato de Comunidad (usuarios, favoritos, temporadas, tier list)`.

### Task 2: Base de datos, configuración y modo v1

**Files:**
- Create: `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/drizzle.config.ts`, `apps/api/drizzle/0000_*.sql` (generada), `apps/api/test/db-helpers.ts`
- Modify: `apps/api/package.json` (deps `drizzle-orm`, `mysql2`; dev `drizzle-kit`; scripts `db:generate`, `db:migrate`), `apps/api/src/config.ts`, `apps/api/src/health.ts`, `apps/api/src/index.ts`, `apps/api/.env.example`, `.github/workflows/ci.yml`
- Test: `apps/api/test/db.test.ts`, `apps/api/test/config.test.ts`

**Interfaces:**
- Produces:
  - Tablas Drizzle `users`, `sessions`, `favorites`, `seasons`, `tierVotes` exactamente como la spec, sección 3.
  - `createDb(url: string): { db: Db; ping(): Promise<boolean>; close(): Promise<void> }` (pool `mysql2`, `connectionLimit: 10`).
  - `type Db` (MySql2Database del schema).
  - `Config` suma `databaseUrl: string|null`, `discordClientId`, `discordClientSecret`, `publicSiteUrl: string` (default `http://localhost:3200`), `adminDiscordIds: string[]`, `authMock: boolean`, `authMockAdmin: boolean`, `nodeEnv`.
  - `createHealth` suma `db?: { ping(): Promise<boolean> }` → `db: 'ok'|'down'|'disabled'`.
  - Test helper `withTestDb(): { db: Db; reset(): Promise<void> } | null` — usa `TEST_DATABASE_URL`, crea el schema `bw_test_<random>`, corre `migrate()` y lo borra en `afterAll`; devuelve `null` si no hay URL (las suites usan `describe.skipIf(!testDb)`).

- [ ] **Step 1: Tests** — `loadConfig` lanza si `AUTH_MOCK=1` y `NODE_ENV=production`; lanza si hay `DATABASE_URL` sin `AUTH_MOCK=1` y faltan `DISCORD_CLIENT_ID`/`SECRET`; `ADMIN_DISCORD_IDS=" 1, 2 "` → `['1','2']`. `createHealth` con `db.ping` que devuelve `false` → `db: 'down'`; sin `db` → `'disabled'`. Con `withTestDb`: insertar un usuario y borrar en cascada sus sesiones, favoritos y votos.
- [ ] **Step 2:** `npm test -w @brawlwiki/api` → FAIL.
- [ ] **Step 3:** Implementar; `npm run db:generate -w @brawlwiki/api` genera la migración inicial (se commitea). `index.ts`: si hay `databaseUrl`, `createDb` + `migrate` no se corre al arrancar (es un paso de deploy); si el ping inicial falla, loguear `warn` y seguir.
- [ ] **Step 4:** CI: servicio `mysql:8` (`MYSQL_ROOT_PASSWORD: test`, healthcheck `mysqladmin ping`) en los dos jobs; env `TEST_DATABASE_URL=mysql://root:test@127.0.0.1:3306`. `.env.example` documenta las variables nuevas sin valores reales.
- [ ] **Step 5:** `npm test && npm run typecheck` → PASS (localmente las suites de DB se omiten si no hay `TEST_DATABASE_URL`).
- [ ] **Step 6:** Commit `feat(api): MySQL con Drizzle, configuración de Comunidad y db en /health`.

### Task 3: Sesiones, middleware de usuario y CSRF

**Files:**
- Create: `apps/api/src/community/sessions.ts`, `apps/api/src/http/auth.ts`, `apps/api/src/http/origin.ts`
- Modify: `apps/api/src/app.ts` (`AppDeps.community?: CommunityDeps`)
- Test: `apps/api/test/sessions.test.ts`, `apps/api/test/auth-middleware.test.ts`

**Interfaces:**
- Produces:
  - `createSessionStore(db: Db, now?: () => number)` → `{ create(userId: number): Promise<string /* token */>; resolve(token: string): Promise<SessionUser|null>; destroy(token: string): Promise<void> }`; `resolve` extiende `expires_at` si quedan < 15 días y devuelve `null` si venció o no existe.
  - `interface SessionUser { id: number; discordId: string; username: string; avatarUrl: string|null; playerTag: string|null }`
  - `SESSION_COOKIE = 'bw_session'`, `sessionCookieOptions(config): CookieOptions`
  - `loadUser(store, adminIds: string[]): RequestHandler` → `req.user?: SessionUser & { isAdmin: boolean }` (Express `Request` ampliado en `src/types.ts`)
  - `requireUser(): RequestHandler` (→ `AppError('UNAUTHENTICATED')`), `requireAdmin(): RequestHandler` (→ `AppError('NOT_FOUND')`)
  - `checkOrigin(publicSiteUrl: string): RequestHandler`
  - `interface CommunityDeps { db: Db; sessions: SessionStore; config: Config; brawlerIds(): Promise<Set<number>>; cache: Cache }`
  - Si la DB falla dentro de cualquier handler de Comunidad → `AppError('DB_UNAVAILABLE')` (helper `dbCall<T>(fn: () => Promise<T>): Promise<T>` en `sessions.ts`).

- [ ] **Step 1: Tests** — token creado se resuelve; tras 31 días (`now` falso) → `null`; con 10 días restantes `expires_at` se extiende a 30; usuario borrado → `null`; `checkOrigin` deja pasar GET sin Origin, rechaza POST con `Origin: https://evil.example` y POST sin Origin (`403 FORBIDDEN`); `requireAdmin` con usuario no admin → 404; cookie con token basura → request sigue sin usuario.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar (`crypto.randomBytes(32).toString('base64url')`, `createHash('sha256')`); parsear la cookie a mano desde `req.headers.cookie` (sin dependencia nueva). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): sesiones en MySQL, usuario por request y chequeo de Origin`.

### Task 4: Login con Discord (y mock)

**Files:**
- Create: `apps/api/src/community/discord.ts`, `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/app.ts` (montar `/api/v1/auth`)
- Test: `apps/api/test/auth-routes.test.ts`

**Interfaces:**
- Consumes: `SessionStore`, `CommunityDeps` (Task 3).
- Produces:
  - `safeNext(value: unknown): string`
  - `createDiscordClient({ clientId, clientSecret, redirectUri, fetchImpl? })` → `{ authorizeUrl(state: string): string; exchange(code: string): Promise<{ id: string; username: string; globalName: string|null; avatar: string|null }> }` (POST `https://discord.com/api/oauth2/token`, GET `https://discord.com/api/users/@me`)
  - `upsertDiscordUser(db, profile): Promise<number /* userId */>` — `username` = `globalName ?? username`; `avatar_url` = `https://cdn.discordapp.com/avatars/{id}/{avatar}.png` o `null`
  - Rutas: `GET /auth/discord?next=`, `GET /auth/discord/callback`, `POST /auth/logout` (requireUser, 204)
  - Cookie temporal `bw_oauth` (`HttpOnly`, `SameSite=Lax`, 10 min) con `{ state, next }` en JSON base64url. No hace falta firmarla: `state` solo se compara con el que vuelve de Discord. El callback la borra.
  - Errores de login → redirect a `${next}?login=error` (la web muestra el aviso).

- [ ] **Step 1: Tests** — `safeNext('//evil.com')`, `safeNext('https://x')`, `safeNext('/\\evil')` → `/`; `safeNext('/tierlist?x=1')` igual. `/auth/discord` → 302 a `discord.com/oauth2/authorize` con `scope=identify` y `state` igual al de la cookie. Callback con `state` distinto → 302 a `/?login=error` sin cookie de sesión. Callback válido (fetch falso) → crea usuario, `Set-Cookie: bw_session` y 302 a `next`; segundo login del mismo `discord_id` actualiza `username` sin duplicar. `AUTH_MOCK=1`: `/auth/discord?next=/cuenta` → sesión de `MockUser` y 302 a `/cuenta`. Logout → 204, la fila de sesión desaparece y la cookie expira.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): login con Discord, modo mock y logout`.

### Task 5: Cuenta (`/me`)

**Files:**
- Create: `apps/api/src/routes/me.ts`
- Test: `apps/api/test/me-routes.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `parseTagParam` (`http/params.ts`), `UserSchema`.
- Produces: `GET /me` → `MeSchema`; `PATCH /me` `{ playerTag: string|null }` → `{ user }`; `DELETE /me` → 204 + cookie expirada. (Montaje común de las rutas de Comunidad en `createCommunityRouter(deps: CommunityDeps): Router`, que `createApp` usa si `deps.community` existe.)

- [ ] **Step 1: Tests** — sin cookie `/me` → `{ user: null }` (200); con sesión → usuario con `isAdmin`; `PATCH` con `"#2pp"` guarda `2PP`; con `"XYZ"` → `400 INVALID_TAG`; `null` lo quita; `DELETE` borra usuario, sesiones, favoritos y votos. Sin `deps.community`, `/api/v1/me` → 404 (modo v1).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(api): rutas /me (ver, vincular tag, borrar cuenta)`.

### Task 6: Favoritos en servidor

**Files:**
- Create: `apps/api/src/routes/favorites.ts`
- Test: `apps/api/test/favorites-routes.test.ts`

**Interfaces:**
- Produces: `GET /me/favorites`, `PUT /me/favorites/:kind/:tag` (`{ name }`), `DELETE /me/favorites/:kind/:tag`, `POST /me/favorites/import` → `{ imported: number }` (solo los nuevos; `INSERT IGNORE`).

- [ ] **Step 1: Tests** — PUT dos veces → una sola fila; DELETE de algo inexistente → 204; `kind` = `brawler` → `400 INVALID_PARAM`; tag inválido → `400 INVALID_TAG`; import de 3 con 1 ya existente → `{ imported: 2 }` y el nombre existente no se pisa; import de 101 → 400; lista ordenada por `createdAt` desc; sin sesión → 401.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(api): favoritos sincronizados e importación desde el navegador`.

### Task 7: Temporadas y tier list

**Files:**
- Create: `apps/api/src/community/tiers.ts`, `apps/api/src/routes/tierlist.ts`
- Modify: `apps/api/src/index.ts` (`brawlerIds` a partir de `services.getBrawlers` cacheado)
- Test: `apps/api/test/tiers.test.ts`, `apps/api/test/tierlist-routes.test.ts`

**Interfaces:**
- Produces:
  - `tierFor(average: number, votes: number): TierLetter|null` (constantes de Global Constraints)
  - `aggregate(rows: { userId: number; brawlerId: number; tier: number }[]): { voters: number; rows: TierRow[] }` — descarta usuarios con < 10 votos antes de promediar; `average` redondeado a 2 decimales; ordenado por `average` desc.
  - Rutas: `GET /seasons`, `POST /seasons` (requireUser + requireAdmin; `{ name: 1..64 chars }`), `GET /tierlist?season=`, `GET /tierlist/me`, `PUT /tierlist/me`.
  - Clave de caché `tierlist:<seasonId>`; rate limit de `PUT` con `express-rate-limit` por `req.user.id`, 10/min.

- [ ] **Step 1: Tests de `tiers.ts`** — `tierFor(4.5, 5)` → `S`; `tierFor(4.49, 5)` → `A`; `tierFor(1.49, 9)` → `D`; `tierFor(5, 4)` → `null`; `aggregate` ignora a un usuario con 9 votos y cuenta a uno con 10.
- [ ] **Step 2: Tests de rutas** — sin temporadas `GET /tierlist` → 404 y `PUT /tierlist/me` → `409 NO_ACTIVE_SEASON`; `POST /seasons` como no admin → 404, como admin → crea y cierra la anterior (solo una con `endedAt` null); `PUT` con brawlerId fuera de `brawlerIds()` → 400 y no cambia nada; `PUT` reemplaza (guardar 12 y luego 10 deja 10 filas); dos `PUT` concurrentes del mismo usuario → el resultado es uno de los dos completo; votar invalida la caché (`GET /tierlist` refleja el voto al instante); `GET /tierlist?season=<cerrada>` funciona; el 11.º `PUT` en un minuto → 429.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implementar (reemplazo con `db.transaction`: `DELETE` + `INSERT` por lotes). **Step 5:** Run → PASS.
- [ ] **Step 6:** Commit `feat(api): temporadas y tier list de la comunidad`.

### Task 8: OpenAPI y health

**Files:**
- Modify: `apps/api/src/openapi.ts`
- Test: `apps/api/test/openapi.test.ts`

- [ ] **Step 1: Test** — el documento contiene `/me`, `/me/favorites`, `/me/favorites/import`, `/tierlist`, `/tierlist/me`, `/seasons`, `/auth/logout`, y los esquemas de Task 1.
- [ ] **Step 2–4:** FAIL → registrar rutas → PASS.
- [ ] **Step 5:** Commit `docs(api): rutas de Comunidad en OpenAPI`.

### Task 9: Cliente de la web con sesión

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queries.ts`
- Create: `apps/web/src/lib/session.ts`, `apps/web/src/app/auth/discord/route.ts`, `apps/web/src/app/auth/discord/callback/route.ts`, `apps/web/src/app/auth/logout/route.ts`
- Test: `apps/web/test/api.test.ts`, `apps/web/test/auth-proxy.test.ts`

**Interfaces:**
- Produces:
  - `apiRequest<T>(method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', path: string, schema: z.ZodType<T>|null, opts: ApiGetOptions & { body?: unknown; cookie?: string|null; origin?: string|null }): Promise<ApiResult<T>|null>` (null para 204); `apiGet` pasa a usarlo sin cambiar su firma.
  - `requestContext(): Promise<{ forwardedFor: string|null; cookie: string|null; origin: string }>` en `queries.ts` (`origin` = `NEXT_PUBLIC_SITE_URL`); las queries existentes lo usan.
  - `getSession = cache(async (): Promise<{ enabled: boolean; user: User|null }>)` en `session.ts`: `enabled: false` si `/me` responde 404 (modo v1) o 503 `DB_UNAVAILABLE`; `user: null` también ante error de red. `getMe()` = `(await getSession()).user`.
  - Route handlers: reenvían a la API sin seguir redirects (`redirect: 'manual'`) y copian `Location` y todos los `Set-Cookie`.

- [ ] **Step 1: Tests** — `apiRequest('PUT', ...)` manda `Cookie`, `Origin`, `Content-Type: application/json` y el body; 204 → `null`; 401 → `ApiError('UNAUTHENTICATED')`. El handler de callback copia dos `Set-Cookie` y el `Location` de la API (fetch falso).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(web): cliente con sesión y proxy del login`.

### Task 10: Header, menú, cuenta y "Mi perfil"

**Files:**
- Create: `apps/web/src/app/cuenta/page.tsx`, `apps/web/src/app/cuenta/actions.ts`, `apps/web/src/components/account/AccountMenu.tsx`, `apps/web/src/components/account/DeleteAccountForm.tsx`, `apps/web/src/components/account/ClaimTagButton.tsx`, `apps/web/src/components/account/LoginNotice.tsx`
- Modify: `apps/web/src/components/layout/Header.tsx`, `apps/web/src/components/layout/NavLinks.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/jugador/[tag]/page.tsx`
- Test: `apps/web/test/account.test.tsx`, `apps/web/test/nav.test.tsx` (existente)

**Interfaces:**
- Consumes: `getSession`, `getMe`, `apiRequest`.
- Produces: Server Actions `linkTag(tag: string|null)`, `logout()`, `deleteAccount(confirm: string)` (exige exactamente `"BORRAR"`).
- Menú inferior: `{ href: '/tierlist', label: 'Tier list', icon: '📊' }` en lugar de Clubes; Clubes como link de texto en el header. `LoginNotice` lee `?login=error` y muestra "No se pudo iniciar sesión con Discord".

- [ ] **Step 1: Tests** — header sin sesión muestra "Entrar" con href `/auth/discord?next=<ruta>`; con sesión muestra el avatar con link a `/cuenta`; con `playerTag` muestra "Mi perfil" → `/jugador/<tag>`; con `getSession()` → `{ enabled: false }` no muestra "Entrar" (el ítem "Tier list" del menú se mantiene y la página muestra que Comunidad no está disponible); `DeleteAccountForm` deshabilita el botón hasta escribir "BORRAR"; `ClaimTagButton` solo aparece con sesión y si el tag no es ya el vinculado.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`/cuenta` sin sesión → `redirect('/auth/discord?next=/cuenta')`).
- [ ] **Step 5:** Commit `feat(web): login en el header, página de cuenta y "Este soy yo"`.

### Task 11: Favoritos con sesión

**Files:**
- Create: `apps/web/src/app/favorites/actions.ts`, `apps/web/src/components/account/FavoritesImporter.tsx`
- Modify: `apps/web/src/components/search/FavoriteButton.tsx`, `apps/web/src/components/search/RecentSearches.tsx` (`SavedList source="favorites"`), `apps/web/src/lib/local-store.ts` (`clearFavorites()`)
- Test: `apps/web/test/favorites-sync.test.tsx`

**Interfaces:**
- Produces: Server Actions `addFavorite(kind, tag, name)`, `removeFavorite(kind, tag)`, `importFavorites(items): Promise<number>`; `FavoriteButton` recibe `signedIn: boolean` e `initial: boolean` desde el servidor. `FavoritesImporter` (cliente, montado en el layout con sesión): si hay favoritos locales, llama `importFavorites`, borra los locales y muestra "Subimos tus N favoritos a tu cuenta" (no se muestra si N = 0).

- [ ] **Step 1: Tests** — con sesión, marcar llama `addFavorite` y no toca `localStorage`; sin sesión, comportamiento actual (tests existentes siguen pasando); importer con 3 locales llama una vez, borra `bw:favorites` y muestra el aviso con el número que devolvió la acción; con 0 no llama.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(web): favoritos en la cuenta e importación en el primer login`.

### Task 12: Página `/tierlist`

**Files:**
- Create: `apps/web/src/app/tierlist/page.tsx`, `apps/web/src/app/tierlist/loading.tsx`, `apps/web/src/components/tierlist/TierBoard.tsx`, `apps/web/src/components/tierlist/SeasonPicker.tsx`
- Modify: `apps/web/src/lib/queries.ts` (`getCommunityTierList(season?: number)`, `getSeasons()`)
- Test: `apps/web/test/tierlist-page.test.tsx`

**Interfaces:**
- Consumes: `CommunityTierListSchema`, `getBrawlers()` (para nombre, imagen y color), `BrawlerCard`.
- Produces: `TierBoard({ rows, brawlers })` — filas S, A, B, C, D y "Pocos votos" (las vacías se muestran con "Sin brawlers"); cada carta muestra los votos (`plural(votes, 'voto', 'votos')`).

- [ ] **Step 1: Tests** — filas en orden S→D→"Pocos votos"; un brawler con `tier: null` va a "Pocos votos"; muestra "N votantes"; sin sesión, CTA "Entra con Discord para votar"; con sesión, "Armar mi tier list" → `/tierlist/editar`; API 404 (sin temporadas) → estado vacío "Todavía no hay una tier list"; `DB_UNAVAILABLE` → `ErrorState` "Comunidad no está disponible ahora".
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(web): tier list de la comunidad con historial de temporadas`.

### Task 13: Editor `/tierlist/editar`

**Files:**
- Create: `apps/web/src/app/tierlist/editar/page.tsx`, `apps/web/src/app/tierlist/actions.ts`, `apps/web/src/components/tierlist/TierEditor.tsx`, `apps/web/src/components/tierlist/TierPicker.tsx`
- Test: `apps/web/test/tier-editor.test.tsx`

**Interfaces:**
- Consumes: `MyTierListSchema`, `SaveTierListBodySchema`, `getBrawlers()`.
- Produces: Server Action `saveTierList(votes): Promise<{ ok: true } | { ok: false; code: ApiErrorCode }>`; borrador en `sessionStorage` bajo `bw:tier-draft:<seasonId>`.

- [ ] **Step 1: Tests** — tocar una carta abre `TierPicker` (diálogo accesible: `role="dialog"`, foco atrapado, Escape cierra) con S A B C D y "Sin ubicar"; elegir A mueve la carta y actualiza el resumen "A: 1"; "Guardar" deshabilitado sin cambios; con cambios, `beforeunload` registrado; guardar → `saveTierList` con todos los votos; respuesta `UNAUTHENTICATED` → aviso "Tu sesión venció" con link de login y el borrador queda en `sessionStorage`; al volver, el borrador se restaura; menos de 10 ubicados → nota "Ubica al menos 10 brawlers para que tu voto cuente" (no bloquea guardar).
- [ ] **Step 2–4:** FAIL → implementar → PASS (página: sin sesión → redirect al login con `next=/tierlist/editar`; `NO_ACTIVE_SEASON` → estado vacío "No hay una temporada abierta para votar").
- [ ] **Step 5:** Commit `feat(web): editor de la tier list personal`.

### Task 14: Admin de temporadas

**Files:**
- Create: `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/admin/actions.ts`
- Test: `apps/web/test/admin.test.tsx`

- [ ] **Step 1: Tests** — sin `isAdmin` → `notFound()`; con admin lista temporadas (activa marcada) y el formulario "Abrir temporada nueva" llama `openSeason(name)`; nombre vacío o > 64 → error en línea.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(web): admin para abrir temporadas`.

### Task 15: E2E, privacidad, deploy y cierre

**Files:**
- Create: `apps/web/e2e/community.spec.ts`
- Modify: `apps/web/playwright.config.ts` (API con `AUTH_MOCK=1`, `AUTH_MOCK_ADMIN=1`, `DATABASE_URL` desde `TEST_DATABASE_URL` + migración antes de arrancar), `apps/web/src/app/acerca/page.tsx`, `deploy/README.md`, `ecosystem.config.cjs` (sin cambios de proceso; comentario de variables), `README.md`
- Test: `apps/web/e2e/community.spec.ts`

- [ ] **Step 1: E2E** — login mock → `/tierlist/editar` → ubicar los 4 brawlers de los fixtures (se ve la nota "Ubica al menos 10 brawlers para que tu voto cuente") → guardar → recargar y la tier list propia sigue igual → `/tierlist` muestra "0 votantes" y los brawlers en "Pocos votos" (el promedio con votos reales lo cubren los tests de Task 7); favorito con sesión sobrevive a recargar; "Este soy yo" en `/jugador/2PP` → "Mi perfil" en el header; `/admin` abre "Temporada E2E" y aparece en el selector; cerrar sesión vuelve a "Entrar"; axe y sin scroll horizontal a 375 px en `/tierlist`, `/tierlist/editar`, `/cuenta`. Si no hay `TEST_DATABASE_URL`, el archivo se omite con `test.skip`.
- [ ] **Step 2:** `npm run e2e` → PASS (local con MySQL, y en CI).
- [ ] **Step 3:** `/acerca` suma la sección de cuentas (qué se guarda, que no se guarda email ni token de Discord, que borrar la cuenta lo elimina todo). `deploy/README.md` suma MySQL (usuario con permisos solo sobre `brawlwiki`), la app de Discord con su redirect URI, `db:migrate` antes de `pm2 reload` y el backup diario: `mysqldump` por cron con 7 días de retención. README: comandos `db:migrate`, variables nuevas.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run e2e` → PASS.
- [ ] **Step 5:** Commit `test(web): E2E de Comunidad; privacidad y deploy con MySQL`.
