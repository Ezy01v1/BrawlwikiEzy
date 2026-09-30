# BrawlWiki v1 — Spec de diseño

**Fecha:** 2026-09-29
**Estado:** Aprobado por secciones en brainstorming, pendiente de revisión final
**Alcance:** Sub-proyecto 1 de 4 (base sin base de datos)

---

## 1. Resumen

Fan page no oficial de Brawl Stars para una comunidad real. Es un proyecto personal que también sirve como pieza de portafolio. Los jugadores buscan su perfil, su club, rankings y el catálogo de brawlers, casi siempre desde el celular y entre partidas: sesiones cortas y frecuentes.

La v1 funciona **solo con la API key oficial de Supercell**, sin base de datos. El backend actúa de proxy y caché, porque la key está atada a una IP y tiene rate limits.

### Objetivos de la v1

- Perfil de jugador, battle log, clubes (con comparador), rankings, catálogo de brawlers y rotación de eventos.
- Que se sienta rápido aunque Supercell tarde: skeletons, streaming y caché.
- Que no se caiga cuando Supercell falla: se sirve el último dato guardado marcado como "stale".
- Dark mode por defecto, mobile-first y WCAG AA.
- Vistas previas con stats al compartir un perfil o club en Discord y WhatsApp.
- Base preparada para crecer (bot de Discord, MySQL) sin rehacer nada.

### Fuera de alcance (v1)

| Feature | Motivo | Sub-proyecto |
|---|---|---|
| Cuentas de usuario, favoritos en servidor | Requiere MySQL | 2 |
| Tier list votable | Requiere MySQL | 2 |
| Acumular battle logs históricos | Requiere MySQL + jobs | 3 |
| Recomendador, tendencias de meta, insights | Requiere dataset acumulado | 4 |
| Deploy en VPS | Aún no hay VPS; se documenta, no se ejecuta | Cuando exista el VPS |
| i18n | Interfaz solo en español | — |

### Sub-proyectos siguientes

1. **v1 (este documento):** base sin base de datos.
2. **Comunidad:** MySQL, usuarios, favoritos y tier list votable.
3. **Acumulación:** guardar battle logs de los jugadores consultados.
4. **Inteligencia:** recomendador, meta e insights (con transparencia sobre las limitaciones del dataset).

---

## 2. Arquitectura

### Enfoque: monorepo con tipos compartidos (npm workspaces)

```
BrawlWikiEzy/
├── apps/
│   ├── api/        Express 5 + TypeScript (la única pieza con la API key)
│   └── web/        Next.js (App Router, última estable) + TypeScript + Tailwind v4
├── packages/
│   └── shared/     Esquemas Zod, tipos, validación de tags, utilidades de fecha
├── docs/
└── package.json    workspaces + scripts raíz (dev, build, test, lint)
```

`npm run dev` levanta `api` (puerto 4000) y `web` (puerto 3000) en paralelo.

### Flujo de datos

```
Navegador ──► Next.js (servidor) ──► Express /api/v1 ──► Caché (memoria | Redis)
                                                   └──► Supercell API (si no hay dato fresco)
                                                   └──► brawler-meta.json local (rareza, clase)
Navegador ──► CDN Brawlify (imágenes, vía next/image)
```

- **Solo el servidor de Next habla con Express.** El navegador nunca llama a `/api/v1`. Tabs, región y filtros van en la URL y se renderizan en el servidor. Lo que tarda (battle log) se carga en streaming con `<Suspense>`.
- Express escucha en `127.0.0.1` y nunca se expone directamente.
- **Crecimiento futuro:** si un bot de Discord corre en el mismo VPS, consume `127.0.0.1:4000/api/v1`. Si corre en otro lado, se expone `/api/` por Nginx con autenticación por token. No se implementa en la v1.

### Por qué un monolito modular y no servicios separados

Hay un solo dev y el tráfico es moderado. Un proceso de API con módulos bien separados es más fácil de operar y depurar. El módulo `supercell/` queda aislado detrás de una interfaz, así que si algún día hace falta sacarlo a un servicio aparte, el cambio es local.

---

## 3. Backend (`apps/api`)

### Estructura

```
apps/api/src/
├── index.ts              arranque, config, listen en HOST:PORT
├── app.ts                construcción de la app Express (testeable sin listen)
├── config.ts             lectura y validación de env con Zod
├── supercell/
│   ├── client.ts         HTTP hacia Supercell: auth, timeout, retry, mapeo de errores
│   ├── fixtures.ts       cliente alternativo que lee JSON (SUPERCELL_MOCK=1)
│   └── fixtures/*.json
├── assets/
│   ├── urls.ts           URLs del CDN por ID
│   ├── brawler-meta.ts   rareza y clase desde brawler-meta.json
│   └── brawler-meta.json
├── cache/
│   ├── cache.ts          interfaz Cache { get, set, del }
│   ├── memory.ts         MemoryCache (LRU con límite de entradas)
│   ├── redis.ts          RedisCache (ioredis)
│   └── cached-fetch.ts   fresco/stale, dedupe en vuelo, caché negativa, cooldown
├── services/             players, clubs, rankings, brawlers, events
│                         (orquestan caché + clientes y mapean a DTOs)
├── routes/v1/            controladores delgados, uno por recurso
└── middleware/           requestId, rateLimit, errorHandler, notFound
```

### Cliente de Supercell

- Base: `https://api.brawlstars.com/v1`. Header `Authorization: Bearer ${SUPERCELL_API_KEY}`.
- Timeout de 5s por request.
- **Reintento:** 1 vez con backoff (300ms + jitter), solo ante 5xx de red o timeout. Nunca ante 4xx ni 429.
- **Concurrencia máxima:** 8 requests simultáneos hacia Supercell (cola simple). Evita ráfagas.
- **Mapeo de errores:**

| Supercell | Error interno |
|---|---|
| 404 | `NOT_FOUND` |
| 429 | `UPSTREAM_RATE_LIMITED` (activa un cooldown) |
| 503 con `reason: inMaintenance` | `UPSTREAM_MAINTENANCE` |
| 5xx, timeout, error de red | `UPSTREAM_UNAVAILABLE` |
| 403 | `UPSTREAM_UNAVAILABLE` + log de nivel `error` ("key inválida o IP no autorizada") |

### Tags

La función `normalizeTag()` vive en `packages/shared` y la usan frontend y backend:

- Quita `#` y espacios, pasa a mayúsculas y reemplaza `O` por `0`.
- Es válido si cumple `/^[0289PYLQGRJCUV]{3,14}$/`. Si no, se responde `INVALID_TAG` sin llamar a Supercell.
- Hacia Supercell se envía como `%23{TAG}`.

### Caché: `cachedFetch(key, policy, fetcher)`

Cada entrada guarda `{ data, fetchedAt }` con dos tiempos: `freshTtl` (se sirve sin preguntar) y `staleTtl` (tiempo total que se conserva como respaldo; es el TTL real de la clave).

| Recurso | Clave | freshTtl | staleTtl |
|---|---|---|---|
| Jugador | `player:{tag}` | 2 min | 7 días |
| Battle log | `battlelog:{tag}` | 2 min | 7 días |
| Club | `club:{tag}` | 10 min | 7 días |
| Rankings | `rank:{tipo}:{region}[:{brawlerId}]` | 15 min | 1 día |
| Rotación de eventos | `events:rotation` | 10 min | 1 día |
| Catálogo de brawlers (Supercell) | `brawlers` | 24 h | 30 días |
| No encontrado (caché negativa) | `404:{clave}` | 1 min | 1 min |

**Algoritmo:**

1. Si existe `404:{clave}`, se lanza `NOT_FOUND` sin llamar a Supercell.
2. Si la entrada existe y `edad < freshTtl`, se devuelve con `source: "cache"`.
3. Si hay un cooldown activo por 429 (`cooldown:supercell`) y existe entrada stale, se devuelve con `source: "stale"`. Si no hay entrada, se lanza `UPSTREAM_RATE_LIMITED`.
4. **Dedupe:** si ya hay una promesa en vuelo para esa clave, se espera esa misma promesa. El mapa de promesas en vuelo vive en memoria del proceso.
5. Se llama al fetcher:
   - **Éxito:** se guarda `{ data, fetchedAt: now }` con TTL `staleTtl` y se devuelve con `source: "fresh"`.
   - **`NOT_FOUND`:** se guarda la clave negativa y se propaga el error.
   - **`UPSTREAM_RATE_LIMITED`:** se activa el cooldown (`Retry-After` de Supercell, o 10s por defecto). Si hay stale, se devuelve con `source: "stale"`; si no, se propaga el error.
   - **`UPSTREAM_MAINTENANCE` / `UPSTREAM_UNAVAILABLE`:** si hay stale, se devuelve con `source: "stale"`; si no, se propaga el error.

**Implementaciones de `Cache`:**
- **`MemoryCache`:** es la opción por defecto si no existe `REDIS_URL`. LRU con un máximo de 5.000 entradas.
- **`RedisCache`:** se activa con `REDIS_URL`. Guarda JSON con `SET key value EX staleTtl`.

> **Cuando crezca:** con más de una instancia de la API, el dedupe en memoria no alcanza. Se agrega un lock en Redis (`SET lock:{key} NX PX 5000`), y las demás instancias esperan o sirven stale. No se implementa en la v1.

### Brawlify (metadatos e imágenes)

La API oficial no devuelve imágenes, rareza ni clase.

> **Revisión del 2026-09-29, al planificar:** la API de Brawlify (`api.brawlify.com`) responde con una página anti-bots ("Security Check") y no se puede consumir desde el servidor. Su **CDN sí funciona** y usa URLs predecibles por ID. Por eso el diseño queda así:

- **Imágenes: URLs construidas por patrón**, sin llamadas de red (verificadas el 2026-09-29):
  - brawler: `https://cdn.brawlify.com/brawlers/borderless/{id}.png`
  - ícono de perfil: `https://cdn.brawlify.com/profile-icons/regular/{id}.png`
  - mapa: `https://cdn.brawlify.com/maps/regular/{id}.png`
  - badge de club: `https://cdn.brawlify.com/club-badges/regular/{id}.png`
  - Si un ID no existe, el CDN devuelve 404 y `GameImage` muestra el fallback.
- **Rareza y clase:** vienen de un archivo local `apps/api/src/assets/brawler-meta.json` (`{ [id]: { rarity: { name, color }, class } }`), que se genera con el script `npm run meta:import -w apps/api -- <archivo.json>`. Ese script convierte el JSON de brawlers de Brawlify que se descarga una vez desde el navegador. Si un brawler no está en el archivo (por ejemplo, uno nuevo), `rarity` y `class` quedan en `null` y se usa el borde neutro.
- **Íconos de modo de juego:** fuera de la v1. `EventCard` muestra la imagen del mapa y el nombre del modo traducido; `mode.imageUrl` siempre es `null`.
- El módulo `assets/` expone `brawlerImageUrl(id)`, `profileIconUrl(id)`, `mapImageUrl(id)`, `clubBadgeUrl(id)` y `getBrawlerMeta(id)`. La respuesta principal nunca depende de un tercero en tiempo de ejecución.

### Rate limiting hacia nuestros usuarios

Como todas las peticiones a Express llegan desde Next (`127.0.0.1`):

- Next reenvía la IP real del usuario en `X-Forwarded-For`, tomada del header entrante que pone Nginx o, en dev, de la conexión.
- Express configura `app.set('trust proxy', 'loopback')` y limita por esa IP con `express-rate-limit`:
  - **General:** 60 requests/min por IP.
  - **Consultas de tag que no están en caché** (las que sí cuestan cuota de Supercell): 20/min por IP. Se aplica dentro de `cachedFetch` solo cuando el paso 5 va a llamar a Supercell.
- El store es memoria en la v1 y se cambia a `rate-limit-redis` si existe `REDIS_URL`.
- **En producción** se agrega además `limit_req` en Nginx como primera barrera.

### Seguridad

- `SUPERCELL_API_KEY` vive solo en `apps/api/.env`. Tanto `.env` como `.env.*` están en `.gitignore` y el repo incluye un `.env.example` sin valores.
- La configuración se valida con Zod al arrancar. Si falta la key y `SUPERCELL_MOCK` no está activo, el proceso no arranca y muestra un mensaje claro.
- Los logs se hacen con **pino** y redactan el header `authorization`. La key nunca aparece en respuestas ni en logs, y hay un test que lo verifica.
- Se usa `helmet` en Express. CORS está **desactivado**, porque ningún navegador llama a Express.
- En producción, los errores `INTERNAL` no incluyen el stack.

### Modo fixtures (`SUPERCELL_MOCK=1`)

`fixtures.ts` implementa la misma interfaz que `client.ts` y lee JSON de `fixtures/`. Incluye tags especiales para forzar escenarios:

| Tag | Escenario |
|---|---|
| `#2PP` | Jugador normal con club |
| `#8QU` | Jugador sin club |
| `#RRRR` | Siempre 429 |
| `#LLLL` | Siempre mantenimiento |
| `#GGGG` | Responde con 4s de retraso |

Los tags de escenario usan solo caracteres válidos, para que pasen `normalizeTag` y lleguen al cliente de fixtures.

Lo usan los tests y el E2E, y sirve para desarrollar cuando la IP de casa cambia y la key deja de funcionar.

---

## 4. Contrato de la API (`/api/v1`)

### Convenciones

- **camelCase** en JSON, igual que TS y que Supercell. Sin conversiones entre capas.
- **Fechas en ISO 8601 UTC.** El formato de Supercell `20260928T120000.000Z` se convierte con `parseSupercellDate()` de `shared`.
- **Tags sin `#`** en la ruta. También se acepta `%23`.
- **Versionado en la URL** (`/api/v1`). Un cambio incompatible crea `/api/v2` y `v1` se mantiene mientras tenga consumidores.
- **DTOs propios:** nunca se reenvía el JSON de Supercell tal cual.
- **Fuente de verdad:** esquemas Zod en `packages/shared`. El documento `openapi.json` se genera con `@asteasolutions/zod-to-openapi` y se sirve en `/api/v1/openapi.json`.

### Endpoints

| Método | Ruta | Respuesta (`data`) |
|---|---|---|
| GET | `/players/:tag` | `Player` |
| GET | `/players/:tag/battlelog` | `Battle[]` |
| GET | `/clubs/:tag` | `Club` (incluye `members`) |
| GET | `/rankings/players?region=global\|{ISO2}&limit=` | `PlayerRanking[]` |
| GET | `/rankings/clubs?region=&limit=` | `ClubRanking[]` |
| GET | `/rankings/brawlers/:brawlerId?region=&limit=` | `PlayerRanking[]` |
| GET | `/brawlers` | `Brawler[]` |
| GET | `/brawlers/:id` | `Brawler` |
| GET | `/events/rotation` | `EventSlot[]` |
| GET | `/health` | `{ status, cache: "memory"\|"redis", supercell: "ok"\|"cooldown"\|"mock" }` |
| GET | `/openapi.json` | Documento OpenAPI 3.1 |

`limit` va de 1 a 200 y por defecto es 50. `region` por defecto es `global`.

### Envoltorio de respuesta exitosa

```json
{
  "data": {},
  "meta": {
    "source": "fresh",
    "fetchedAt": "2026-09-29T12:00:00.000Z",
    "ageSeconds": 0
  }
}
```

`source` puede ser `"fresh"`, `"cache"` o `"stale"`.

**Headers reflejo:**

| Header | Valor |
|---|---|
| `X-Cache-Status` | `MISS` si es fresh, `HIT` si viene de caché, `STALE` si es stale |
| `X-Data-Age` | segundos |
| `X-Request-Id` | ID del request |

### Envoltorio de error

```json
{ "error": { "code": "NOT_FOUND", "message": "No existe un jugador con ese tag.", "requestId": "01J…", "retryAfter": 30 } }
```

`retryAfter` solo se incluye cuando aplica.

| code | HTTP | Cuándo |
|---|---|---|
| `INVALID_TAG` | 400 | El tag no pasa la validación |
| `INVALID_PARAM` | 400 | `region`, `limit` o `brawlerId` inválidos |
| `NOT_FOUND` | 404 | No existe en Supercell, o la ruta no existe |
| `RATE_LIMITED` | 429 | Nuestro límite por IP. Incluye el header `Retry-After` |
| `UPSTREAM_RATE_LIMITED` | 503 | Supercell nos limitó y no hay stale. Incluye `retryAfter` |
| `UPSTREAM_MAINTENANCE` | 503 | Mantenimiento y no hay stale |
| `UPSTREAM_UNAVAILABLE` | 503 | Supercell caído o key/IP inválida, y no hay stale |
| `INTERNAL` | 500 | Error inesperado |

### DTOs (resumen; la definición exacta vive en los esquemas Zod)

- **`Player`:** `tag`, `name`, `nameColor`, `icon { id, imageUrl|null }`, `trophies`, `highestTrophies`, `expLevel`, `victories { trio, duo, solo }`, `club { tag, name } | null`, `brawlers: PlayerBrawler[]`.
- **`PlayerBrawler`:** `id`, `name`, `power`, `rank`, `trophies`, `highestTrophies`, `gadgets[]`, `starPowers[]`, `gears[]`, `imageUrl|null`, `rarity { name, color } | null`.
- **`Battle`:** `battleTime`, `mode`, `map { id, name, imageUrl|null }`, `type`, `result: "victory"|"defeat"|"draw"|null`, `rank|null` (showdown), `trophyChange|null`, `durationSeconds|null`, `starPlayerTag|null`, `teams: BattlePlayer[][]`.
- **`Club`:** `tag`, `name`, `description`, `type`, `badgeId`, `requiredTrophies`, `trophies`, `members: ClubMember[]`.
- **`ClubMember`:** `tag`, `name`, `role`, `trophies`, `icon`.
- **`Brawler`:** `id`, `name`, `imageUrl|null`, `rarity|null`, `class|null`, `gadgets[]`, `starPowers[]`.
- **`EventSlot`:** `slotId`, `startTime`, `endTime`, `mode { name, imageUrl|null }`, `map { id, name, imageUrl|null }`.
- **`PlayerRanking` / `ClubRanking`:** `rank`, `tag`, `name`, `trophies`, más `icon` y `club`, o `badgeId` y `memberCount`, según el tipo.

---

## 5. Design system: "Negro competitivo"

### Tokens de color

Todos son variables CSS en `:root` (dark, default) y `[data-theme="light"]`, y Tailwind v4 los consume vía `@theme`. Los contrastes están calculados con la fórmula WCAG 2.x.

| Token | Dark | Contraste (sobre `bg`) | Light | Contraste |
|---|---|---|---|---|
| `bg` | `#0B0B0F` | — | `#F5F5F7` | — |
| `surface` | `#15151C` | — | `#FFFFFF` | — |
| `surface-2` | `#1F1F29` | — | `#EDEDF2` | — |
| `border` | `#2C2C3A` | — | `#D6D6DF` | — |
| `fg` | `#F2F2F5` | 17.6 | `#121218` | 17.1 |
| `muted` | `#A1A1B3` | 7.7 | `#565669` | 6.6 |
| `primary` (texto) | `#FFC61A` | 12.5 | `#8A6300` | 5.0 |
| `primary-fill` | `#FFC61A` | — | `#FFC61A` | — |
| `on-primary` | `#14110A` (12.0 sobre fill) | — | `#14110A` | — |
| `primary-shadow` | `#A87F00` | — | `#A87F00` | — |
| `accent` | `#FF8A1A` | 8.3 | `#A84C00` | 5.2 |
| `win` | `#3EDC81` | 11.0 | `#0B7A3B` | 5.0 |
| `loss` | `#FF5C6F` | 6.6 | `#C21F37` | 5.4 |
| `info` | `#4DB8FF` | 9.0 | `#0A62B0` | 5.7 |

El peor caso para texto es 4.66 (`primary` light sobre `surface-2`), por encima del mínimo AA de 4.5. En modo claro, el amarillo puro se usa **solo como relleno** con texto `on-primary`.

**Colores de rareza:** se toman de Brawlify (`rarity.color`). Si no llegan, se usa este mapa de respaldo:

| Rareza | Color |
|---|---|
| Común | `#B9EAFF` |
| Raro | `#68FD58` |
| Súper raro | `#5AB3FF` |
| Épico | `#D850FF` |
| Mítico | `#FE5E72` |
| Legendario | `#FFF11E` |

La rareza nunca se comunica solo con color: también aparece como texto en el detalle y en el `aria-label`.

### Tipografía

Se carga con `next/font` (self-hosted, sin parpadeo).

| Rol | Fuente | Tamaño / interlineado |
|---|---|---|
| display | Lilita One | 32/36 |
| h1 | Lilita One | 24/28 |
| h2 | Lilita One | 18/24, mayúsculas |
| body | Inter 400 | 15/22 |
| small | Inter 400 | 13/18 |
| label | Inter 700 | 11/14, mayúsculas, tracking 0.8px |

- Lilita One solo se usa en títulos y números grandes, nunca en párrafos.
- Todos los números usan `font-variant-numeric: tabular-nums`.

### Espaciado, radios, sombras y movimiento

- **Espaciado:** base 4px, con la escala 4, 8, 12, 16, 24, 32, 48. Margen lateral de 16px en móvil y 24px desde `md`.
- **Radios:** 8px (chips, inputs), 12px (tarjetas), 999px (pills).
- **Sombras:** en dark, la profundidad se marca por niveles de superficie, no con sombras. El botón primario lleva `0 3px 0 primary-shadow`, estilo botón del juego, y al presionarlo baja 2px. En light se agrega una sombra suave (`0 1px 3px rgba(0,0,0,.08)`) en tarjetas.
- **Movimiento:** duraciones de 150ms (hover, press) a 250ms (entrada de contenido) con ease-out. Solo se animan `transform` y `opacity`. Con `prefers-reduced-motion: reduce` se desactivan el brillo del skeleton, el conteo de números y los desplazamientos (queda solo un fade de 100ms).
- **Interacción:**
  - Áreas táctiles de al menos 44×44px.
  - Foco visible: `outline: 2px solid primary` con offset de 2px.
  - Hover en `BrawlerTile`: `translateY(-2px)` y el borde de rareza se intensifica.

### Tema

- El tema por defecto es dark. La preferencia se guarda en la cookie `theme` y el layout raíz la lee en el servidor para renderizar `data-theme` correcto sin parpadeo.
- `ThemeToggle` actualiza la cookie y el atributo sin recargar la página.

### Integración de assets

| Asset | Fuente | Tratamiento |
|---|---|---|
| Logo, splash arts, branding | Fan Kit de Supercell, descargado a `apps/web/public/fankit/` | Encima de los splash va un degradado de `transparent` a `bg` al 85% antes de cualquier texto |
| Íconos de brawler y de perfil, mapas, modos | CDN de Brawlify (URLs incluidas en los DTOs) | `next/image` en 64, 96 y 128px en WebP, con `remotePatterns` restringido al dominio del CDN |
| Fallback | Local | `GameImage`: si falla la carga o `imageUrl` es `null`, muestra una silueta y las iniciales sobre `surface-2` |

**Regla del `BrawlerTile`:**
- El área del arte es cuadrada, con un fondo radial del color de rareza mezclado al 30% con `#0B0B0F`. Esa base oscura se mantiene en ambos temas, como una carta del juego.
- **El texto nunca va sobre la imagen:** el nombre y los trofeos van en una barra sólida `surface` debajo, con una franja de 3px del color de rareza.

---

## 6. Frontend (`apps/web`)

### Rutas

| Ruta | Datos | Notas |
|---|---|---|
| `/` | `/events/rotation` | Búsqueda grande, recientes (localStorage), eventos |
| `/jugador/[tag]?tab=resumen\|brawlers\|partidas` | `/players/:tag`, battle log en `<Suspense>` | OG image dinámica |
| `/club/[tag]` | `/clubs/:tag` | OG image dinámica |
| `/clubes/comparar?a=&b=` | 2 × `/clubs/:tag` en paralelo | Si falta un club, se pide con `TagSearch` |
| `/rankings?tipo=jugadores\|clubes\|brawler&region=&brawler=` | `/rankings/*` | Región con selector de países |
| `/brawlers?rareza=&clase=&q=` | `/brawlers` | Filtrado del lado del servidor por params |
| `/brawlers/[id]` | `/brawlers/:id` + `/rankings/brawlers/:id` | |

- Toda la navegación de estado (tabs, filtros, región) va en la URL: se puede compartir y el botón atrás funciona.
- Cada segmento tiene `loading.tsx` (skeleton con la forma exacta del contenido), `error.tsx` y, donde aplica, `not-found.tsx`.

### Acceso a datos

- `src/lib/api.ts` expone funciones tipadas (`getPlayer(tag)`, etc.) que llaman a `API_INTERNAL_URL` con:
  - `cache: 'no-store'`, porque la caché vive solo en Express;
  - timeout de 6s;
  - el header `X-Forwarded-For` con la IP del usuario.
- Las respuestas se validan con los esquemas Zod de `shared`.
- Los errores se lanzan como `ApiError { code, message, retryAfter }`. `NOT_FOUND` llama a `notFound()` y los demás llegan a `error.tsx`.

### Componentes (`src/components/`)

- **`ui/`:** `Button` (primary/secondary/ghost), `Card`, `Chip`, `Tabs` (con links, sin estado de cliente), `Skeleton`, `GameImage`, `AnimatedNumber`, `ThemeToggle`, `Disclaimer`.
- **`states/`:** `StaleBadge`, `ErrorState` (mensaje según `code` + botón de reintentar con `router.refresh()`), `EmptyState`, `MaintenanceNotice`.
- **`search/`:** `TagSearch` (valida con `normalizeTag` antes de navegar; detecta si el tag es de jugador o de club por la ruta de destino).
- **`player/`:** `PlayerHeader`, `PlayerStats`, `BrawlerGrid` (orden por trofeos, poder o nombre), `BattleLog`, `BattleRow` (expandible con los equipos).
- **`brawler/`:** `BrawlerTile`, `BrawlerDetail`.
- **`club/`:** `ClubCard`, `ClubMemberRow`, `ClubCompare` (barras por métrica con el número siempre visible).
- **`rankings/`:** `LeaderboardList` (lista en móvil, tabla desde `md`), `RankBadge` (oro, plata y bronce para el top 3).
- **`events/`:** `EventCard` (mapa, modo y tiempo restante).
- **`layout/`:** `Header` (logo + búsqueda compacta), `BottomNav` (móvil: Inicio, Rankings, Brawlers, Clubes), `TopNav` (desde `md`), `Footer` (contiene `Disclaimer`).

Los componentes de cliente (`"use client"`) son solo los que lo necesitan: `TagSearch`, `ThemeToggle`, `AnimatedNumber`, `BattleRow` (expandir), `FavoriteButton` y `RecentSearches`.

### Estado local del navegador

- **Favoritos** (★ en perfil y club) y **búsquedas recientes** (máximo 10) se guardan en `localStorage` bajo `bw:favorites` y `bw:recent`.
- Las lecturas y escrituras van en `try/catch` y la interfaz funciona aunque `localStorage` no esté disponible.
- Cuando llegue MySQL (sub-proyecto 2), se migran a la cuenta del usuario.

### Disclaimer

"Este material es no oficial y no está avalado por Supercell." aparece:
- en el `Footer` de todas las páginas;
- en las imágenes OG;
- en la página "Acerca de", junto con la referencia a la [Fan Content Policy de Supercell](https://supercell.com/en/fan-content-policy/).

### Previews para Discord y WhatsApp

- `opengraph-image.tsx` en `/jugador/[tag]` y `/club/[tag]`, hecho con `next/og`, de 1200×630.
- Muestra nombre, trofeos y top 3 brawlers (o los datos del club), con los colores del sistema y el disclaimer al pie.
- `generateMetadata` define el título y la descripción.

### Responsive

Mobile-first, con los breakpoints de Tailwind: `sm` 640, `md` 768, `lg` 1024.

| Elemento | Móvil | Desde `md` | Desde `lg` |
|---|---|---|---|
| Navegación | `BottomNav` | `TopNav` | — |
| `BrawlerGrid` | 4 columnas | 6 columnas | 8 columnas |
| Rankings | Lista | Tabla | — |
| Perfil | Una columna | — | Resumen a la izquierda, tabs a la derecha |

---

## 7. Manejo de errores (experiencia de usuario)

| Situación | Comportamiento |
|---|---|
| Tag con formato inválido | `TagSearch` muestra un error en línea y no navega. Si se llega por URL, Express responde `INVALID_TAG` y se ve la página "Tag inválido" con la ayuda de `O` → `0` |
| `NOT_FOUND` | `not-found.tsx`: "No encontramos ese jugador/club" + `TagSearch` |
| Respuesta `stale` | Contenido normal + `StaleBadge` discreto: "Dato de hace {edad} · Supercell no responde" |
| `UPSTREAM_MAINTENANCE` | `MaintenanceNotice`: "Brawl Stars está en mantenimiento, vuelve en un rato" |
| `RATE_LIMITED` / `UPSTREAM_RATE_LIMITED` | "Vas muy rápido 😅" + cuenta regresiva según `retryAfter` y botón de reintentar al terminar |
| `UPSTREAM_UNAVAILABLE`, Express caído, timeout | `ErrorState` genérico + reintentar. El `requestId` se muestra en letra pequeña para depurar |
| Falla una imagen | Fallback de `GameImage`. Nunca aparece un ícono roto |
| Falla solo el battle log | El perfil se muestra igual. El error queda dentro del `Suspense` del battle log |

---

## 8. Testing

| Paquete | Herramienta | Qué se prueba |
|---|---|---|
| `shared` | Vitest | `normalizeTag` (casos `O`→`0`, `#`, minúsculas, inválidos), `parseSupercellDate`, esquemas Zod |
| `api` | Vitest + supertest, modo fixtures y cliente falso inyectable | Ver la lista de abajo |
| `web` | Vitest + Testing Library | `TagSearch` (validación y navegación), `GameImage` (fallback), `StaleBadge` (texto de edad), `BattleRow` (resultado anunciado con texto, expandible por teclado), `ThemeToggle` |
| E2E | Playwright contra `api` en modo fixtures | Buscar jugador → perfil → tab Partidas → expandir partida → ir a otro jugador; comparar dos clubes; rankings cambiando región; cambiar tema; tags de escenario (`#LLLL`, `#RRRR`) |
| a11y | `@axe-core/playwright` en cada página del E2E | Cero violaciones serias o críticas |
| Rendimiento | Lighthouse móvil (manual, antes de cerrar la v1) | LCP < 1.5s, CLS < 0.05, TBT < 200ms en `/` y `/jugador/[tag]` |

**Qué se prueba en `api`:**
- Envoltorio de respuesta y de error.
- Headers `X-Cache-Status`, `X-Data-Age` y `X-Request-Id`.
- `cachedFetch`: fresco, desde caché, stale ante 503/429/timeout, caché negativa de 404.
- Cooldown después de un 429.
- **Dedupe:** 2 requests simultáneos generan exactamente 1 llamada upstream.
- Rate limit por IP con `X-Forwarded-For`.
- `INVALID_TAG` no llama upstream.
- brawler sin metadatos → `rarity` y `class` en `null`; URLs del CDN correctas.
- La key no aparece en respuestas ni en logs capturados.

Los tests del backend usan `MemoryCache`. `RedisCache` comparte una suite de contrato que se ejecuta solo si existe `REDIS_URL`.

---

## 9. Configuración y operación

### Variables de entorno

**`apps/api/.env`** (se incluye `.env.example` en el repo):

| Variable | Valor por defecto | Notas |
|---|---|---|
| `SUPERCELL_API_KEY` | — | Obligatoria salvo con mock |
| `SUPERCELL_API_BASE` | `https://api.brawlstars.com/v1` | |
| `SUPERCELL_MOCK` | `0` | |
| `HOST` | `127.0.0.1` | |
| `PORT` | `4000` | |
| `REDIS_URL` | vacío | Vacío → `MemoryCache` |
| `LOG_LEVEL` | `info` | |

**`apps/web/.env.local`:**

| Variable | Valor por defecto |
|---|---|
| `API_INTERNAL_URL` | `http://127.0.0.1:4000/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

### Desarrollo local

- La key debe estar registrada con la IP pública de casa. Si la IP cambia, se crea otra key en developer.brawlstars.com o se trabaja con `SUPERCELL_MOCK=1`.
- `npm run dev` levanta todo. `npm test` corre las suites de todos los paquetes y `npm run e2e` corre Playwright.

### Deploy (documentado, no se ejecuta en la v1)

- VPS Ubuntu con IP fija registrada en la key. Node 24 LTS, Redis y Nginx.
- **PM2 (`ecosystem.config.cjs`):**
  - `bw-api`: `apps/api`, 1 instancia, `127.0.0.1:4000`.
  - `bw-web`: `next start`, `127.0.0.1:3000`.
- **Nginx:** TLS con Let's Encrypt → `127.0.0.1:3000`, más `limit_req` (10 r/s por IP, burst 20). El puerto 4000 no se expone.
- **Cuándo escalar:** si hay tráfico sostenido de más de 50 req/s o la CPU de `bw-web` se satura, pasar `bw-web` a modo cluster en PM2. Si se agregan instancias de `bw-api`, implementar el lock en Redis (sección 3).

---

## 10. Riesgos y limitaciones conocidas

- **Key atada a IP.** En desarrollo, un cambio de IP rompe la key. Mitigación: modo fixtures y el mensaje claro del 403.
- **Dependencia del CDN de Brawlify** (tercero no oficial) para imágenes. Mitigación: fallback visual en `GameImage` y URLs aisladas en `assets/urls.ts`. La rareza es local y hay que actualizarla con `meta:import` cuando salgan brawlers nuevos.
- **Battle log limitado.** Supercell solo da las últimas ~25 partidas, así que las stats de "últimas partidas" son solo eso; la interfaz lo dice explícitamente.
- **La cuota de Supercell no está documentada con precisión.** Mitigación: caché, dedupe, límite de concurrencia, rate limit por IP y cooldown ante 429.
- **Fan Content Policy.** No se usa el nombre "Brawl Stars" como marca del sitio ni se imita la interfaz oficial de Supercell. El disclaimer va en todas las páginas y el sitio no se monetiza sin revisar la política.
