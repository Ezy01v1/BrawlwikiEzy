# BrawlWiki v1 — Plan 1: `shared` + `api`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo con `packages/shared` (tags, fechas, esquemas Zod) y `apps/api` (Express 5 que hace de proxy/caché hacia la API de Brawl Stars con fallback stale, dedupe, rate limiting, modo fixtures y OpenAPI), totalmente probado.

**Architecture:** npm workspaces. `shared` se consume como código TypeScript fuente (sin build). `api` es un monolito modular: cliente de Supercell (real o fixtures) → `cachedFetch` (fresco/stale/dedupe/cooldown) → servicios que mapean a DTOs → rutas `/api/v1` con envoltorio `{ data, meta }` y errores `{ error }`. En esta etapa la caché es en memoria, y Redis se activa con `REDIS_URL`.

**Tech Stack:** Node 24, TypeScript 5.9 (ESM), Express 5.2, Zod 4, Vitest 5, supertest 7, pino 10 + pino-http 11, helmet 8, express-rate-limit 8 (+ rate-limit-redis 6), ioredis 6, @asteasolutions/zod-to-openapi 9, tsx 4.

**Spec:** `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md` (secciones 2, 3, 4, 8 y 9). El frontend (`apps/web`) va en el Plan 2.

## Global Constraints

- Node 24, `"type": "module"` en todos los paquetes, TypeScript `~5.9.3`. No se usa TS 7: Next.js y el tooling todavía se validan contra 5.x.
- La API corre con `tsx` tanto en dev como en prod (`node --import tsx src/index.ts`). No hay paso de build.
- JSON en **camelCase**. Fechas en **ISO 8601 UTC** (`2026-09-28T12:00:00.000Z`).
- Los **tags van sin `#`** en rutas y DTOs (`"2PP"`). La validación es `/^[0289PYLQGRJCUV]{3,14}$/` después de normalizar (mayúsculas, sin `#` ni espacios, `O`→`0`).
- Respuesta exitosa: `{ "data": …, "meta": { "source": "fresh"|"cache"|"stale", "fetchedAt": ISO, "ageSeconds": int } }`. Headers: `X-Cache-Status: MISS|HIT|STALE`, `X-Data-Age`, `X-Request-Id`.
- Error: `{ "error": { "code", "message", "requestId", "retryAfter"? } }`. Códigos y status: `INVALID_TAG` 400, `INVALID_PARAM` 400, `NOT_FOUND` 404, `RATE_LIMITED` 429, `UPSTREAM_RATE_LIMITED` 503, `UPSTREAM_MAINTENANCE` 503, `UPSTREAM_UNAVAILABLE` 503, `INTERNAL` 500.
- Todos los mensajes para el usuario van en **español**.
- La API escucha en `127.0.0.1:4000` por defecto. `SUPERCELL_API_KEY` nunca aparece en respuestas ni en logs.
- Tiempos de caché en segundos (fresh/stale): jugador y battle log 120/604800, club 600/604800, rankings 900/86400, eventos 600/86400, brawlers 86400/2592000. Caché negativa de 404: 60.
- Cliente de Supercell: timeout de 5000ms, 1 reintento (300ms + jitter de hasta 200ms) solo ante red, timeout o 5xx que no sea mantenimiento. Máximo 8 requests simultáneos. Cooldown por 429 igual a `Retry-After`, o 10s por defecto.
- Rate limit: 60 req/min por IP (general) y 20 llamadas upstream/min por IP. `trust proxy` = `loopback`.
- CDN de imágenes: `https://cdn.brawlify.com/brawlers/borderless/{id}.png`, `/profile-icons/regular/{id}.png`, `/maps/regular/{id}.png`, `/club-badges/regular/{id}.png`.
- Los comandos se ejecutan desde la raíz del repo en **Git Bash** (Windows).
- Mensajes de commit estilo conventional (`feat(api): …`) y terminados en la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Jugador sin club.** Supercell envía `"club": {}`. Se espera `club: null` en el DTO sin romper nada. Test en Task 9.
2. **Battle log con formas raras:** showdown solo (`players` en vez de `teams`), duelos (`brawlers[]` en vez de `brawler`) y eventos sin mapa (`event.id` 0 o sin `map`). Se espera que se mapeen sin excepción. Tests en Task 9.
3. **Caché que falla o tiene basura** (Redis caído, JSON corrupto). Se espera que se trate como "no hay dato" y se consulte a Supercell, sin devolver 500. Test en Task 7.
4. **Supercell responde 200 con un cuerpo que no es JSON** (HTML de un proxy o mantenimiento). Se espera `UPSTREAM_UNAVAILABLE` y el fallback a stale, sin devolver 500. Test en Task 5.
5. **Parámetros de query sucios:** `region=mx` debe funcionar como `MX`; `limit=500`, `limit=abc` y `limit=0` deben dar `INVALID_PARAM`; un `brawlerId` no numérico debe dar `INVALID_PARAM`. Tests en Task 11.

---

## Estructura de archivos

```
BrawlWikiEzy/
├── package.json                     workspaces + scripts raíz
├── tsconfig.base.json               opciones TS compartidas
├── packages/shared/
│   ├── package.json                 "@brawlwiki/shared", exports → src/index.ts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/index.ts                 re-exports
│   ├── src/tags.ts                  normalizeTag, isValidTag, parseTag, TAG_REGEX
│   ├── src/dates.ts                 parseSupercellDate
│   ├── src/schemas.ts               esquemas Zod de DTOs, meta, errores, envelope
│   └── test/{tags,dates,schemas}.test.ts
└── apps/api/
    ├── package.json                 "@brawlwiki/api"
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── .env.example
    ├── scripts/import-brawler-meta.ts
    ├── src/
    │   ├── index.ts                 arranque (config → logger → cache → cliente → app → listen)
    │   ├── app.ts                   createApp(deps) (testeable sin listen)
    │   ├── config.ts                loadConfig(env)
    │   ├── errors.ts                AppError, statusFor, defaultMessage
    │   ├── logger.ts                createLogger(level, destination?)
    │   ├── openapi.ts               buildOpenApiDocument()
    │   ├── http/request-id.ts       middleware requestId
    │   ├── http/error-handler.ts    errorHandler, notFoundHandler
    │   ├── http/respond.ts          sendData(res, result, now)
    │   ├── http/params.ts           parseTagParam, parseRegion, parseLimit, parseBrawlerId
    │   ├── http/rate-limit.ts       createGeneralLimiter, createUpstreamGuard
    │   ├── cache/cache.ts           interfaz Cache
    │   ├── cache/memory.ts          createMemoryCache
    │   ├── cache/redis.ts           createRedisCache
    │   ├── cache/policies.ts        POLICIES, NEGATIVE_TTL_SECONDS
    │   ├── cache/cached-fetch.ts    createCachedFetch
    │   ├── supercell/types.ts       tipos crudos + interfaz SupercellApi
    │   ├── supercell/limiter.ts     createLimiter
    │   ├── supercell/client.ts      createSupercellClient
    │   ├── supercell/fixtures.ts    createFixtureClient
    │   ├── supercell/fixtures/*.json
    │   ├── assets/urls.ts           URLs del CDN
    │   ├── assets/brawler-meta.ts   getBrawlerMeta, convertBrawlifyBrawlers
    │   ├── assets/brawler-meta.json
    │   ├── mappers/{player,battle,club,rankings,brawler,event}.ts
    │   ├── services.ts              createServices
    │   ├── health.ts                createHealth
    │   └── routes/v1.ts             createV1Router
    └── test/
        ├── helpers.ts               createTestApp, fakeFetch
        └── *.test.ts
```

---

### Task 1: Monorepo + `shared`: tags y fechas

**Files:**
- Create: `package.json`, `tsconfig.base.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`, `packages/shared/src/tags.ts`, `packages/shared/src/dates.ts`
- Test: `packages/shared/test/tags.test.ts`, `packages/shared/test/dates.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `TAG_REGEX: RegExp`
  - `normalizeTag(input: string): string` (sin `#`, sin espacios, mayúsculas, `O`→`0`)
  - `isValidTag(tag: string): boolean` (sobre un tag ya normalizado)
  - `parseTag(input: string): string | null` (normalizado si es válido, `null` si no)
  - `parseSupercellDate(value: string): string` (ISO; lanza `Error` si el formato es inválido)

- [ ] **Step 1: Crear la raíz del monorepo**

`package.json`:
```json
{
  "name": "brawlwiki",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "npm run dev -w @brawlwiki/api",
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^5.0.2"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```

`packages/shared/package.json`:
```json
{
  "name": "@brawlwiki/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": { "zod": "^4.6.5" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test", "vitest.config.ts"] }
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

Run: `npm install && npm install -D @types/node@^24`
Expected: se crea `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 2: Escribir los tests que fallan**

`packages/shared/test/tags.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTag, parseTag } from '../src/tags';

describe('normalizeTag', () => {
  it('quita #, espacios y pasa a mayúsculas', () => {
    expect(normalizeTag('  #2pp ')).toBe('2PP');
  });
  it('reemplaza la letra O por el cero', () => {
    expect(normalizeTag('#8oQu')).toBe('80QU');
  });
  it('acepta %23 de una URL', () => {
    expect(normalizeTag('%232PP')).toBe('2PP');
  });
});

describe('isValidTag', () => {
  it('acepta solo el alfabeto de Supercell', () => {
    expect(isValidTag('2PP')).toBe(true);
    expect(isValidTag('ABC')).toBe(false);
  });
  it('exige entre 3 y 14 caracteres', () => {
    expect(isValidTag('2P')).toBe(false);
    expect(isValidTag('2'.repeat(14))).toBe(true);
    expect(isValidTag('2'.repeat(15))).toBe(false);
  });
});

describe('parseTag', () => {
  it('devuelve el tag normalizado si es válido', () => {
    expect(parseTag('#2pp')).toBe('2PP');
  });
  it('devuelve null si es inválido', () => {
    expect(parseTag('hola!')).toBeNull();
    expect(parseTag('')).toBeNull();
  });
});
```

`packages/shared/test/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSupercellDate } from '../src/dates';

describe('parseSupercellDate', () => {
  it('convierte el formato compacto de Supercell a ISO 8601', () => {
    expect(parseSupercellDate('20260928T120000.000Z')).toBe('2026-09-28T12:00:00.000Z');
  });
  it('lanza error con formato inválido', () => {
    expect(() => parseSupercellDate('ayer')).toThrow('Fecha de Supercell inválida');
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/shared`
Expected: FAIL, "Failed to resolve import ../src/tags".

- [ ] **Step 4: Implementar**

`packages/shared/src/tags.ts`:
```ts
export const TAG_REGEX = /^[0289PYLQGRJCUV]{3,14}$/;

export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^%23/i, '')
    .replace(/^#/, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/O/g, '0');
}

export function isValidTag(tag: string): boolean {
  return TAG_REGEX.test(tag);
}

export function parseTag(input: string): string | null {
  const tag = normalizeTag(input);
  return isValidTag(tag) ? tag : null;
}
```

`packages/shared/src/dates.ts`:
```ts
const SUPERCELL_DATE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/;

export function parseSupercellDate(value: string): string {
  const m = SUPERCELL_DATE.exec(value);
  if (!m) throw new Error(`Fecha de Supercell inválida: ${value}`);
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}
```

`packages/shared/src/index.ts`:
```ts
export * from './tags';
export * from './dates';
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/shared && npm run typecheck -w @brawlwiki/shared`
Expected: PASS (9 tests) y typecheck sin errores.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json packages/shared
git commit -m "feat(shared): monorepo, normalización de tags y fechas de Supercell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `shared`: esquemas Zod del contrato

**Files:**
- Create: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/schemas.test.ts`

**Interfaces:**
- Consumes: nada de otras tasks.
- Produces (esquemas y sus tipos `z.infer`, con el mismo nombre sin `Schema`):
  - `ErrorCodeSchema` (enum de los 8 códigos) → `ErrorCode`
  - `ApiErrorBodySchema` → `ApiErrorBody` = `{ error: { code, message, requestId, retryAfter? } }`
  - `MetaSchema` → `Meta` = `{ source: 'fresh'|'cache'|'stale', fetchedAt: string, ageSeconds: number }`
  - `envelopeSchema<T extends z.ZodType>(data: T)` → `z.object({ data, meta: MetaSchema })`
  - `ImageRefSchema` = `{ id: number, imageUrl: string | null }`
  - `RaritySchema` = `{ name: string, color: string }`
  - `NamedItemSchema` = `{ id: number, name: string }`
  - `PlayerBrawlerSchema`, `PlayerSchema`, `BattlePlayerSchema`, `BattleSchema`, `ClubMemberSchema`, `ClubSchema`, `BrawlerSchema`, `EventSlotSchema`, `PlayerRankingSchema`, `ClubRankingSchema`, `HealthSchema` (campos abajo)

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  ApiErrorBodySchema,
  BattleSchema,
  envelopeSchema,
  PlayerSchema,
} from '../src/schemas';

const player = {
  tag: '2PP',
  name: 'EzyPlayer',
  nameColor: null,
  icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
  trophies: 42310,
  highestTrophies: 43002,
  expLevel: 187,
  victories: { trio: 3412, duo: 300, solo: 612 },
  club: null,
  brawlers: [
    {
      id: 16000000,
      name: 'SHELLY',
      power: 11,
      rank: 25,
      trophies: 750,
      highestTrophies: 800,
      gadgets: [{ id: 23000255, name: 'FAST FORWARD' }],
      starPowers: [],
      gears: [],
      imageUrl: null,
      rarity: null,
      class: null,
    },
  ],
};

describe('esquemas del contrato', () => {
  it('PlayerSchema acepta un jugador válido', () => {
    expect(PlayerSchema.parse(player)).toEqual(player);
  });

  it('PlayerSchema rechaza un tag con #', () => {
    expect(() => PlayerSchema.parse({ ...player, tag: '#2PP' })).toThrow();
  });

  it('envelopeSchema envuelve data + meta', () => {
    const Env = envelopeSchema(PlayerSchema);
    const body = {
      data: player,
      meta: { source: 'stale', fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 30 },
    };
    expect(Env.parse(body)).toEqual(body);
  });

  it('BattleSchema permite result y rank nulos (showdown)', () => {
    const battle = {
      battleTime: '2026-09-29T12:00:00.000Z',
      mode: 'soloShowdown',
      type: 'ranked',
      map: { id: null, name: null, imageUrl: null },
      result: null,
      rank: 2,
      trophyChange: 9,
      durationSeconds: null,
      starPlayerTag: null,
      teams: [[{ tag: '2PP', name: 'Ezy', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, imageUrl: null } }]],
    };
    expect(BattleSchema.parse(battle)).toEqual(battle);
  });

  it('ApiErrorBodySchema exige un código conocido', () => {
    expect(() =>
      ApiErrorBodySchema.parse({ error: { code: 'OOPS', message: 'x', requestId: 'r' } }),
    ).toThrow();
    expect(
      ApiErrorBodySchema.parse({ error: { code: 'NOT_FOUND', message: 'x', requestId: 'r' } }).error.code,
    ).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/shared -- schemas`
Expected: FAIL, "Failed to resolve import ../src/schemas".

- [ ] **Step 3: Implementar**

`packages/shared/src/schemas.ts`:
```ts
import { z } from 'zod';
import { TAG_REGEX } from './tags';

const Tag = z.string().regex(TAG_REGEX);
const IsoDate = z.iso.datetime();
const Url = z.string().url();

export const ErrorCodeSchema = z.enum([
  'INVALID_TAG',
  'INVALID_PARAM',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_MAINTENANCE',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    retryAfter: z.number().int().nonnegative().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const DataSourceSchema = z.enum(['fresh', 'cache', 'stale']);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const MetaSchema = z.object({
  source: DataSourceSchema,
  fetchedAt: IsoDate,
  ageSeconds: z.number().int().nonnegative(),
});
export type Meta = z.infer<typeof MetaSchema>;

export function envelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: MetaSchema });
}

export const ImageRefSchema = z.object({ id: z.number().int(), imageUrl: Url.nullable() });
export type ImageRef = z.infer<typeof ImageRefSchema>;

export const RaritySchema = z.object({ name: z.string(), color: z.string() });
export type Rarity = z.infer<typeof RaritySchema>;

export const NamedItemSchema = z.object({ id: z.number().int(), name: z.string() });
export type NamedItem = z.infer<typeof NamedItemSchema>;

export const PlayerBrawlerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  power: z.number().int(),
  rank: z.number().int(),
  trophies: z.number().int(),
  highestTrophies: z.number().int(),
  gadgets: z.array(NamedItemSchema),
  starPowers: z.array(NamedItemSchema),
  gears: z.array(NamedItemSchema),
  imageUrl: Url.nullable(),
  rarity: RaritySchema.nullable(),
  class: z.string().nullable(),
});
export type PlayerBrawler = z.infer<typeof PlayerBrawlerSchema>;

export const PlayerSchema = z.object({
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  icon: ImageRefSchema,
  trophies: z.number().int(),
  highestTrophies: z.number().int(),
  expLevel: z.number().int(),
  victories: z.object({
    trio: z.number().int(),
    duo: z.number().int(),
    solo: z.number().int(),
  }),
  club: z.object({ tag: Tag, name: z.string() }).nullable(),
  brawlers: z.array(PlayerBrawlerSchema),
});
export type Player = z.infer<typeof PlayerSchema>;

export const BattlePlayerSchema = z.object({
  tag: Tag,
  name: z.string(),
  brawler: z.object({
    id: z.number().int(),
    name: z.string(),
    power: z.number().int(),
    trophies: z.number().int(),
    imageUrl: Url.nullable(),
  }),
});
export type BattlePlayer = z.infer<typeof BattlePlayerSchema>;

export const BattleSchema = z.object({
  battleTime: IsoDate,
  mode: z.string(),
  type: z.string().nullable(),
  map: z.object({
    id: z.number().int().nullable(),
    name: z.string().nullable(),
    imageUrl: Url.nullable(),
  }),
  result: z.enum(['victory', 'defeat', 'draw']).nullable(),
  rank: z.number().int().nullable(),
  trophyChange: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  starPlayerTag: Tag.nullable(),
  teams: z.array(z.array(BattlePlayerSchema)),
});
export type Battle = z.infer<typeof BattleSchema>;

export const ClubMemberSchema = z.object({
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  role: z.string(),
  trophies: z.number().int(),
  icon: ImageRefSchema,
});
export type ClubMember = z.infer<typeof ClubMemberSchema>;

export const ClubSchema = z.object({
  tag: Tag,
  name: z.string(),
  description: z.string(),
  type: z.string(),
  badgeId: z.number().int(),
  badgeImageUrl: Url.nullable(),
  requiredTrophies: z.number().int(),
  trophies: z.number().int(),
  members: z.array(ClubMemberSchema),
});
export type Club = z.infer<typeof ClubSchema>;

export const BrawlerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  imageUrl: Url.nullable(),
  rarity: RaritySchema.nullable(),
  class: z.string().nullable(),
  gadgets: z.array(NamedItemSchema),
  starPowers: z.array(NamedItemSchema),
});
export type Brawler = z.infer<typeof BrawlerSchema>;

export const EventSlotSchema = z.object({
  slotId: z.number().int(),
  startTime: IsoDate,
  endTime: IsoDate,
  mode: z.object({ name: z.string(), imageUrl: Url.nullable() }),
  map: z.object({
    id: z.number().int().nullable(),
    name: z.string().nullable(),
    imageUrl: Url.nullable(),
  }),
});
export type EventSlot = z.infer<typeof EventSlotSchema>;

export const PlayerRankingSchema = z.object({
  rank: z.number().int(),
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  trophies: z.number().int(),
  icon: ImageRefSchema,
  clubName: z.string().nullable(),
});
export type PlayerRanking = z.infer<typeof PlayerRankingSchema>;

export const ClubRankingSchema = z.object({
  rank: z.number().int(),
  tag: Tag,
  name: z.string(),
  trophies: z.number().int(),
  badgeId: z.number().int(),
  badgeImageUrl: Url.nullable(),
  memberCount: z.number().int(),
});
export type ClubRanking = z.infer<typeof ClubRankingSchema>;

export const HealthSchema = z.object({
  status: z.literal('ok'),
  cache: z.enum(['memory', 'redis']),
  supercell: z.enum(['ok', 'cooldown', 'mock']),
});
export type Health = z.infer<typeof HealthSchema>;
```

`packages/shared/src/index.ts`:
```ts
export * from './tags';
export * from './dates';
export * from './schemas';
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/shared && npm run typecheck -w @brawlwiki/shared`
Expected: PASS (14 tests), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): esquemas Zod del contrato /api/v1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `api`: esqueleto (config, errores, logger, requestId, errorHandler, `/health`)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/types.ts`, `apps/api/src/errors.ts`, `apps/api/src/config.ts`, `apps/api/src/logger.ts`
- Create: `apps/api/src/http/request-id.ts`, `apps/api/src/http/error-handler.ts`, `apps/api/src/http/respond.ts`
- Create: `apps/api/src/app.ts`
- Test: `apps/api/test/config.test.ts`, `apps/api/test/app.test.ts`

**Interfaces:**
- Consumes: `ErrorCode`, `DataSource`, `Health`, `ApiErrorBody` de `@brawlwiki/shared`.
- Produces:
  - `DataResult<T> = { data: T; source: DataSource; fetchedAt: number }` (`fetchedAt` en epoch ms) en `src/types.ts`
  - `class AppError extends Error { code: ErrorCode; status: number; retryAfter?: number }`, con constructor `new AppError(code, message?, { retryAfter?, cause? }?)`
  - `isAppError(e: unknown): e is AppError`, `statusFor(code): number`, `UPSTREAM_CODES: ReadonlySet<ErrorCode>`
  - `loadConfig(env?): Config`, donde `Config = { supercellApiKey: string | null; supercellApiBase: string; supercellMock: boolean; host: string; port: number; redisUrl: string | null; logLevel: string }`
  - `createLogger(level: string, destination?: DestinationStream): Logger` (re-exporta el tipo `Logger` de pino)
  - `requestId(): RequestHandler` (define `res.locals.requestId` y el header `X-Request-Id`)
  - `errorHandler(logger): ErrorRequestHandler`, `notFoundHandler(): RequestHandler`
  - `sendData<T>(res: Response, result: DataResult<T>, now?: number): void`
  - `createApp(deps: AppDeps): Express` con `AppDeps = { logger: Logger; health: () => Health }`. Las Tasks 10, 12 y 13 amplían `AppDeps`.

- [ ] **Step 1: Crear el paquete**

`apps/api/package.json`:
```json
{
  "name": "@brawlwiki/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --import tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json",
    "meta:import": "tsx scripts/import-brawler-meta.ts"
  },
  "dependencies": {
    "@asteasolutions/zod-to-openapi": "^9.1.0",
    "@brawlwiki/shared": "*",
    "express": "^5.2.1",
    "express-rate-limit": "^8.7.0",
    "helmet": "^8.3.0",
    "ioredis": "^6.0.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "rate-limit-redis": "^6.0.1",
    "tsx": "^4.23.15",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/supertest": "^7.2.1",
    "supertest": "^7.3.0"
  }
}
```

`apps/api/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test", "scripts", "vitest.config.ts"] }
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

Run: `npm install`
Expected: se instalan las dependencias y `node_modules/@brawlwiki/shared` queda enlazado.

- [ ] **Step 2: Escribir los tests que fallan**

`apps/api/test/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('aplica valores por defecto', () => {
    const c = loadConfig({ SUPERCELL_API_KEY: 'k' });
    expect(c).toEqual({
      supercellApiKey: 'k',
      supercellApiBase: 'https://api.brawlstars.com/v1',
      supercellMock: false,
      host: '127.0.0.1',
      port: 4000,
      redisUrl: null,
      logLevel: 'info',
    });
  });

  it('exige la key si no está en modo mock', () => {
    expect(() => loadConfig({})).toThrow('Falta SUPERCELL_API_KEY');
  });

  it('permite arrancar sin key en modo mock y trata strings vacíos como ausentes', () => {
    const c = loadConfig({ SUPERCELL_MOCK: '1', SUPERCELL_API_KEY: '', REDIS_URL: '' });
    expect(c.supercellMock).toBe(true);
    expect(c.supercellApiKey).toBeNull();
    expect(c.redisUrl).toBeNull();
  });
});
```

`apps/api/test/app.test.ts`:
```ts
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/errors';
import { errorHandler } from '../src/http/error-handler';
import { requestId } from '../src/http/request-id';
import { createLogger } from '../src/logger';

const logger = createLogger('silent');

describe('app base', () => {
  it('GET /api/v1/health responde con envoltorio y headers', async () => {
    const app = createApp({ logger, health: () => ({ status: 'ok', cache: 'memory', supercell: 'mock' }) });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', cache: 'memory', supercell: 'mock' });
    expect(res.body.meta.source).toBe('fresh');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-cache-status']).toBe('MISS');
  });

  it('ruta desconocida → 404 NOT_FOUND con requestId del header', async () => {
    const app = createApp({ logger, health: () => ({ status: 'ok', cache: 'memory', supercell: 'ok' }) });
    const res = await request(app).get('/api/v1/nada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('errores inesperados → 500 INTERNAL sin filtrar el mensaje original', async () => {
    const app = express();
    app.use(requestId());
    app.get('/boom', () => {
      throw new Error('secreto interno');
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('secreto interno');
  });

  it('AppError con retryAfter agrega el header Retry-After', async () => {
    const app = express();
    app.use(requestId());
    app.get('/lento', () => {
      throw new AppError('RATE_LIMITED', undefined, { retryAfter: 30 });
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/lento');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('30');
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 30 });
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/api`
Expected: FAIL, "Failed to resolve import ../src/config" (y lo mismo para `../src/app`).

- [ ] **Step 4: Implementar**

`apps/api/src/types.ts`:
```ts
import type { DataSource } from '@brawlwiki/shared';

/** Resultado de una lectura con procedencia. `fetchedAt` en epoch ms. */
export interface DataResult<T> {
  data: T;
  source: DataSource;
  fetchedAt: number;
}
```

`apps/api/src/errors.ts`:
```ts
import type { ErrorCode } from '@brawlwiki/shared';

const STATUS: Record<ErrorCode, number> = {
  INVALID_TAG: 400,
  INVALID_PARAM: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_MAINTENANCE: 503,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

const MESSAGES: Record<ErrorCode, string> = {
  INVALID_TAG: 'El tag no es válido. Los tags solo usan los caracteres 0289PYLQGRJCUV.',
  INVALID_PARAM: 'Parámetro inválido.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  RATE_LIMITED: 'Demasiadas solicitudes. Espera un momento.',
  UPSTREAM_RATE_LIMITED: 'Supercell nos pidió bajar el ritmo. Intenta en unos segundos.',
  UPSTREAM_MAINTENANCE: 'Brawl Stars está en mantenimiento. Vuelve en un rato.',
  UPSTREAM_UNAVAILABLE: 'No pudimos contactar a Supercell. Intenta de nuevo.',
  INTERNAL: 'Ocurrió un error inesperado.',
};

export const UPSTREAM_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_MAINTENANCE',
  'UPSTREAM_UNAVAILABLE',
]);

export function statusFor(code: ErrorCode): number {
  return STATUS[code];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string = MESSAGES[code],
    options: { retryAfter?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
```

`apps/api/src/config.ts`:
```ts
import { z } from 'zod';

const EnvSchema = z.object({
  SUPERCELL_API_KEY: z.string().optional(),
  SUPERCELL_API_BASE: z.string().url().default('https://api.brawlstars.com/v1'),
  SUPERCELL_MOCK: z.enum(['0', '1']).default('0'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export interface Config {
  supercellApiKey: string | null;
  supercellApiBase: string;
  supercellMock: boolean;
  host: string;
  port: number;
  redisUrl: string | null;
  logLevel: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const present = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const e = EnvSchema.parse(present);
  const mock = e.SUPERCELL_MOCK === '1';
  if (!mock && !e.SUPERCELL_API_KEY) {
    throw new Error(
      'Falta SUPERCELL_API_KEY en apps/api/.env (o usa SUPERCELL_MOCK=1 para trabajar con fixtures).',
    );
  }
  return {
    supercellApiKey: e.SUPERCELL_API_KEY ?? null,
    supercellApiBase: e.SUPERCELL_API_BASE,
    supercellMock: mock,
    host: e.HOST,
    port: e.PORT,
    redisUrl: e.REDIS_URL ?? null,
    logLevel: e.LOG_LEVEL,
  };
}
```

`apps/api/src/logger.ts`:
```ts
import pino, { type DestinationStream, type Logger } from 'pino';

export type { Logger };

const REDACT = [
  'authorization',
  '*.authorization',
  'headers.authorization',
  'req.headers.authorization',
  'apiKey',
  '*.apiKey',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  const options = { level, redact: { paths: REDACT, censor: '[redacted]' } };
  return destination ? pino(options, destination) : pino(options);
}
```

`apps/api/src/http/request-id.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export function requestId(): RequestHandler {
  return (_req, res, next) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
```

`apps/api/src/http/error-handler.ts`:
```ts
import type { ApiErrorBody } from '@brawlwiki/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, isAppError } from '../errors';
import type { Logger } from '../logger';

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => next(new AppError('NOT_FOUND', 'Ruta no encontrada.'));
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const requestId = String(res.locals.requestId ?? '');
    const appErr = isAppError(err) ? err : new AppError('INTERNAL');
    if (!isAppError(err)) logger.error({ err, requestId }, 'error no controlado');

    const body: ApiErrorBody = {
      error: { code: appErr.code, message: appErr.message, requestId },
    };
    if (appErr.retryAfter !== undefined) {
      body.error.retryAfter = appErr.retryAfter;
      res.setHeader('Retry-After', String(appErr.retryAfter));
    }
    res.status(appErr.status).json(body);
  };
}
```

`apps/api/src/http/respond.ts`:
```ts
import type { Response } from 'express';
import type { DataResult } from '../types';

const CACHE_STATUS = { fresh: 'MISS', cache: 'HIT', stale: 'STALE' } as const;

export function sendData<T>(res: Response, result: DataResult<T>, now: number = Date.now()): void {
  const ageSeconds = Math.max(0, Math.floor((now - result.fetchedAt) / 1000));
  res.setHeader('X-Cache-Status', CACHE_STATUS[result.source]);
  res.setHeader('X-Data-Age', String(ageSeconds));
  res.json({
    data: result.data,
    meta: {
      source: result.source,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      ageSeconds,
    },
  });
}
```

`apps/api/src/app.ts`:
```ts
import type { Health } from '@brawlwiki/shared';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';

export interface AppDeps {
  logger: Logger;
  health: () => Health;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());

  app.get('/api/v1/health', (_req, res) => {
    sendData(res, { data: deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api && npm run typecheck -w @brawlwiki/api`
Expected: PASS (7 tests), typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat(api): esqueleto Express con config, errores, requestId y /health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `api`: caché (interfaz, memoria, Redis, políticas)

**Files:**
- Create: `apps/api/src/cache/cache.ts`, `apps/api/src/cache/memory.ts`, `apps/api/src/cache/redis.ts`, `apps/api/src/cache/policies.ts`
- Test: `apps/api/test/cache.test.ts`

**Interfaces:**
- Consumes: nada de otras tasks.
- Produces:
  - `interface Cache { readonly kind: 'memory' | 'redis'; get<T>(key: string): Promise<T | undefined>; set<T>(key: string, value: T, ttlSeconds: number): Promise<void>; del(key: string): Promise<void> }`
  - `createMemoryCache(opts?: { max?: number; now?: () => number }): Cache` (LRU, 5000 entradas por defecto, clona los valores)
  - `createRedisCache(url: string): RedisCache` con `RedisCache = Cache & { client: Redis; quit(): Promise<void> }`
  - `interface CachePolicy { freshTtl: number; staleTtl: number }` (segundos)
  - `POLICIES: { player; battlelog; club; rankings; events; brawlers }` (todos `CachePolicy`)
  - `NEGATIVE_TTL_SECONDS = 60`, `DEFAULT_COOLDOWN_SECONDS = 10`

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/cache.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Cache } from '../src/cache/cache';
import { createMemoryCache } from '../src/cache/memory';
import { createRedisCache } from '../src/cache/redis';

function contract(name: string, make: () => Cache | Promise<Cache>) {
  describe(`Cache contract: ${name}`, () => {
    it('guarda y lee valores JSON', async () => {
      const c = await make();
      await c.set('k:1', { a: 1, b: ['x'] }, 60);
      expect(await c.get('k:1')).toEqual({ a: 1, b: ['x'] });
    });

    it('devuelve undefined si no existe', async () => {
      const c = await make();
      expect(await c.get('k:nope')).toBeUndefined();
    });

    it('del borra la clave', async () => {
      const c = await make();
      await c.set('k:2', 1, 60);
      await c.del('k:2');
      expect(await c.get('k:2')).toBeUndefined();
    });

    it('los valores leídos no comparten referencia con lo guardado', async () => {
      const c = await make();
      const v = { n: 1 };
      await c.set('k:3', v, 60);
      v.n = 2;
      expect(await c.get('k:3')).toEqual({ n: 1 });
    });
  });
}

contract('memory', () => createMemoryCache());

describe.skipIf(!process.env.REDIS_URL)('redis', () => {
  contract('redis', () => createRedisCache(process.env.REDIS_URL!));
});

describe('MemoryCache específico', () => {
  it('expira según el TTL usando el reloj inyectado', async () => {
    let t = 0;
    const c = createMemoryCache({ now: () => t });
    await c.set('k', 'v', 10);
    t = 9_999;
    expect(await c.get('k')).toBe('v');
    t = 10_000;
    expect(await c.get('k')).toBeUndefined();
  });

  it('desaloja la entrada menos usada al superar max', async () => {
    const c = createMemoryCache({ max: 2 });
    await c.set('a', 1, 60);
    await c.set('b', 2, 60);
    await c.get('a'); // a pasa a ser la más reciente
    await c.set('c', 3, 60); // desaloja b
    expect(await c.get('a')).toBe(1);
    expect(await c.get('b')).toBeUndefined();
    expect(await c.get('c')).toBe(3);
  });

  it('kind es memory', () => {
    expect(createMemoryCache().kind).toBe('memory');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- cache`
Expected: FAIL, "Failed to resolve import ../src/cache/memory".

- [ ] **Step 3: Implementar**

`apps/api/src/cache/cache.ts`:
```ts
export interface Cache {
  readonly kind: 'memory' | 'redis';
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

`apps/api/src/cache/memory.ts`:
```ts
import type { Cache } from './cache';

interface Slot {
  value: unknown;
  expiresAt: number;
}

export function createMemoryCache(opts: { max?: number; now?: () => number } = {}): Cache {
  const max = opts.max ?? 5000;
  const now = opts.now ?? Date.now;
  const store = new Map<string, Slot>();

  return {
    kind: 'memory',
    async get<T>(key: string) {
      const slot = store.get(key);
      if (!slot) return undefined;
      if (now() >= slot.expiresAt) {
        store.delete(key);
        return undefined;
      }
      // Reinsertar para marcarla como la más reciente (orden LRU del Map).
      store.delete(key);
      store.set(key, slot);
      return structuredClone(slot.value) as T;
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      store.delete(key);
      store.set(key, { value: structuredClone(value), expiresAt: now() + ttlSeconds * 1000 });
      while (store.size > max) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    async del(key: string) {
      store.delete(key);
    },
  };
}
```

`apps/api/src/cache/redis.ts`:
```ts
import Redis from 'ioredis';
import type { Cache } from './cache';

export type RedisCache = Cache & { client: Redis; quit(): Promise<void> };

export function createRedisCache(url: string): RedisCache {
  const client = new Redis(url, { maxRetriesPerRequest: 1 });

  return {
    kind: 'redis',
    client,
    async get<T>(key: string) {
      const raw = await client.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      await client.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.ceil(ttlSeconds)));
    },
    async del(key: string) {
      await client.del(key);
    },
    async quit() {
      await client.quit();
    },
  };
}
```

`apps/api/src/cache/policies.ts`:
```ts
export interface CachePolicy {
  /** Segundos durante los que el dato se sirve sin consultar a Supercell. */
  freshTtl: number;
  /** Segundos totales que el dato se conserva como respaldo (TTL real de la clave). */
  staleTtl: number;
}

const DAY = 86_400;

export const POLICIES = {
  player: { freshTtl: 120, staleTtl: 7 * DAY },
  battlelog: { freshTtl: 120, staleTtl: 7 * DAY },
  club: { freshTtl: 600, staleTtl: 7 * DAY },
  rankings: { freshTtl: 900, staleTtl: DAY },
  events: { freshTtl: 600, staleTtl: DAY },
  brawlers: { freshTtl: DAY, staleTtl: 30 * DAY },
} satisfies Record<string, CachePolicy>;

export const NEGATIVE_TTL_SECONDS = 60;
export const DEFAULT_COOLDOWN_SECONDS = 10;
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- cache && npm run typecheck -w @brawlwiki/api`
Expected: PASS (7 tests de memoria; la suite de Redis aparece como *skipped* salvo que exista `REDIS_URL`), typecheck limpio. Si el typecheck falla en `import Redis from 'ioredis'` porque ioredis 6 cambió su export por defecto, cambiar a `import { Redis } from 'ioredis'` en `redis.ts`, que es la exportación con nombre y existe en ambas versiones.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cache apps/api/test/cache.test.ts
git commit -m "feat(api): caché intercambiable (memoria LRU / Redis) y políticas TTL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `api`: cliente de Supercell (timeout, reintento, concurrencia, errores)

**Files:**
- Create: `apps/api/src/supercell/types.ts`, `apps/api/src/supercell/limiter.ts`, `apps/api/src/supercell/client.ts`
- Create: `apps/api/test/helpers.ts`
- Test: `apps/api/test/supercell-client.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 3), `DEFAULT_COOLDOWN_SECONDS` (Task 4), `Logger` (Task 3).
- Produces:
  - Tipos crudos: `RawPlayer`, `RawPlayerBrawler`, `RawBattleLog`, `RawBattle`, `RawBattlePlayer`, `RawClub`, `RawClubMember`, `RawPlayerRanking`, `RawClubRanking`, `RawBrawler`, `RawEventSlot`, `RawList<T>`
  - `interface SupercellApi { readonly mode: 'live' | 'mock'; getPlayer(tag); getBattleLog(tag); getClub(tag); getPlayerRankings(region, limit); getClubRankings(region, limit); getBrawlerRankings(region, brawlerId, limit); getBrawlers(); getEventRotation() }`. Los tags se reciben **normalizados y sin `#`**.
  - `createLimiter(max: number): <T>(fn: () => Promise<T>) => Promise<T>`
  - `createSupercellClient(opts: SupercellClientOptions): SupercellApi` con `SupercellClientOptions = { apiKey: string; baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number; maxConcurrent?: number; retryDelayMs?: number; logger?: Logger }`
  - `fakeFetch(responses)` en `test/helpers.ts`: devuelve `{ impl: typeof fetch; calls: { url: string; init?: RequestInit }[] }`

- [ ] **Step 1: Escribir el helper de tests y los tests que fallan**

`apps/api/test/helpers.ts`:
```ts
export type FakeResponse =
  | { status: number; body?: unknown; text?: string; headers?: Record<string, string> }
  | Error;

export function fakeFetch(responses: FakeResponse[] | ((url: string) => FakeResponse)) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const r = typeof responses === 'function' ? responses(url) : responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    const payload = r.text ?? JSON.stringify(r.body ?? {});
    return new Response(payload, {
      status: r.status,
      headers: { 'content-type': 'application/json', ...r.headers },
    });
  }) as typeof fetch;
  return { impl, calls };
}
```

`apps/api/test/supercell-client.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../src/logger';
import { createSupercellClient } from '../src/supercell/client';
import { createLimiter } from '../src/supercell/limiter';
import { fakeFetch } from './helpers';

const BASE = 'https://api.test/v1';
const KEY = 'super-secret-key';

function client(f: ReturnType<typeof fakeFetch>, extra: Partial<Parameters<typeof createSupercellClient>[0]> = {}) {
  return createSupercellClient({ apiKey: KEY, baseUrl: BASE, fetchImpl: f.impl, retryDelayMs: 0, ...extra });
}

describe('createSupercellClient', () => {
  it('envía la key como Bearer y codifica el # del tag', async () => {
    const f = fakeFetch([{ status: 200, body: { tag: '#2PP' } }]);
    await client(f).getPlayer('2PP');
    expect(f.calls[0]!.url).toBe(`${BASE}/players/%232PP`);
    expect(new Headers(f.calls[0]!.init?.headers).get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('arma las rutas de rankings, brawlers y eventos', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { items: [] } }));
    const c = client(f);
    await c.getPlayerRankings('MX', 200);
    await c.getClubRankings('global', 200);
    await c.getBrawlerRankings('global', 16000000, 200);
    await c.getBrawlers();
    await c.getEventRotation();
    await c.getBattleLog('2PP');
    await c.getClub('2YPLQ');
    expect(f.calls.map((x) => x.url)).toEqual([
      `${BASE}/rankings/MX/players?limit=200`,
      `${BASE}/rankings/global/clubs?limit=200`,
      `${BASE}/rankings/global/brawlers/16000000?limit=200`,
      `${BASE}/brawlers`,
      `${BASE}/events/rotation`,
      `${BASE}/players/%232PP/battlelog`,
      `${BASE}/clubs/%232YPLQ`,
    ]);
  });

  it('404 → NOT_FOUND sin reintentar', async () => {
    const f = fakeFetch([{ status: 404, body: { reason: 'notFound' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.calls).toHaveLength(1);
  });

  it('429 → UPSTREAM_RATE_LIMITED con retryAfter del header, sin reintentar', async () => {
    const f = fakeFetch([{ status: 429, body: { reason: 'throttled' }, headers: { 'retry-after': '7' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED', retryAfter: 7 });
    expect(f.calls).toHaveLength(1);
  });

  it('429 sin Retry-After usa el cooldown por defecto (10s)', async () => {
    const f = fakeFetch([{ status: 429, body: {} }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ retryAfter: 10 });
  });

  it('503 inMaintenance → UPSTREAM_MAINTENANCE sin reintentar', async () => {
    const f = fakeFetch([{ status: 503, body: { reason: 'inMaintenance' } }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_MAINTENANCE' });
    expect(f.calls).toHaveLength(1);
  });

  it('500 y luego 200 → reintenta una vez y devuelve el dato', async () => {
    const f = fakeFetch([{ status: 500 }, { status: 200, body: { tag: '#2PP' } }]);
    await expect(client(f).getPlayer('2PP')).resolves.toEqual({ tag: '#2PP' });
    expect(f.calls).toHaveLength(2);
  });

  it('error de red dos veces → UPSTREAM_UNAVAILABLE tras 2 intentos', async () => {
    const f = fakeFetch([new TypeError('fetch failed'), new TypeError('fetch failed')]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(f.calls).toHaveLength(2);
  });

  it('200 con cuerpo no-JSON (HTML de un proxy) → UPSTREAM_UNAVAILABLE', async () => {
    const f = fakeFetch([{ status: 200, text: '<!DOCTYPE html><title>Maintenance</title>' }]);
    await expect(client(f).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('403 → UPSTREAM_UNAVAILABLE y log de error sin la key', async () => {
    const error = vi.fn();
    const logger = { error } as unknown as Logger;
    const f = fakeFetch([{ status: 403, body: { reason: 'accessDenied.invalidIp' } }]);
    await expect(client(f, { logger }).getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain(KEY);
    expect(JSON.stringify(error.mock.calls)).toContain('accessDenied.invalidIp');
  });

  it('timeout → UPSTREAM_UNAVAILABLE', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      })) as typeof fetch;
    const c = createSupercellClient({ apiKey: KEY, baseUrl: BASE, fetchImpl: hang, timeoutMs: 20, retryDelayMs: 0 });
    await expect(c.getPlayer('2PP')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('mode es live', () => {
    expect(client(fakeFetch([])).mode).toBe('live');
  });
});

describe('createLimiter', () => {
  it('nunca ejecuta más de max tareas a la vez', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return 'ok';
      });
    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(peak).toBe(2);
  });

  it('propaga el rechazo y libera el cupo', async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limit(async () => 'sigue')).resolves.toBe('sigue');
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/api -- supercell-client`
Expected: FAIL, "Failed to resolve import ../src/supercell/client".

- [ ] **Step 3: Implementar**

`apps/api/src/supercell/types.ts`:
```ts
/** Formas crudas que devuelve https://api.brawlstars.com/v1. Solo los campos que usamos. */
export interface RawIcon {
  id: number;
}
export interface RawNamed {
  id: number;
  name: string;
}
export interface RawPlayerBrawler {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
  gadgets?: RawNamed[];
  starPowers?: RawNamed[];
  gears?: (RawNamed & { level?: number })[];
}
export interface RawPlayer {
  tag: string;
  name: string;
  nameColor?: string;
  icon: RawIcon;
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  '3vs3Victories'?: number;
  soloVictories?: number;
  duoVictories?: number;
  club?: { tag?: string; name?: string };
  brawlers: RawPlayerBrawler[];
}
export interface RawBattleBrawler {
  id: number;
  name: string;
  power: number;
  trophies: number;
}
export interface RawBattlePlayer {
  tag: string;
  name: string;
  brawler?: RawBattleBrawler;
  brawlers?: RawBattleBrawler[];
}
export interface RawEventRef {
  id?: number;
  mode?: string;
  map?: string | null;
}
export interface RawBattle {
  battleTime: string;
  event: RawEventRef;
  battle: {
    mode?: string;
    type?: string;
    result?: 'victory' | 'defeat' | 'draw';
    rank?: number;
    duration?: number;
    trophyChange?: number;
    starPlayer?: { tag: string } | null;
    teams?: RawBattlePlayer[][];
    players?: RawBattlePlayer[];
  };
}
export interface RawBattleLog {
  items: RawBattle[];
}
export interface RawClubMember {
  tag: string;
  name: string;
  nameColor?: string;
  role: string;
  trophies: number;
  icon: RawIcon;
}
export interface RawClub {
  tag: string;
  name: string;
  description?: string;
  type: string;
  badgeId: number;
  requiredTrophies: number;
  trophies: number;
  members?: RawClubMember[];
}
export interface RawPlayerRanking {
  tag: string;
  name: string;
  nameColor?: string;
  icon: RawIcon;
  trophies: number;
  rank: number;
  club?: { name: string };
}
export interface RawClubRanking {
  tag: string;
  name: string;
  badgeId: number;
  trophies: number;
  rank: number;
  memberCount: number;
}
export interface RawBrawler {
  id: number;
  name: string;
  starPowers?: RawNamed[];
  gadgets?: RawNamed[];
}
export interface RawEventSlot {
  startTime: string;
  endTime: string;
  slotId: number;
  event: RawEventRef;
}
export interface RawList<T> {
  items: T[];
}

/** Tags siempre normalizados y sin '#'. `region` es 'global' o un código ISO de 2 letras en mayúsculas. */
export interface SupercellApi {
  readonly mode: 'live' | 'mock';
  getPlayer(tag: string): Promise<RawPlayer>;
  getBattleLog(tag: string): Promise<RawBattleLog>;
  getClub(tag: string): Promise<RawClub>;
  getPlayerRankings(region: string, limit: number): Promise<RawList<RawPlayerRanking>>;
  getClubRankings(region: string, limit: number): Promise<RawList<RawClubRanking>>;
  getBrawlerRankings(region: string, brawlerId: number, limit: number): Promise<RawList<RawPlayerRanking>>;
  getBrawlers(): Promise<RawList<RawBrawler>>;
  getEventRotation(): Promise<RawEventSlot[]>;
}
```

`apps/api/src/supercell/limiter.ts`:
```ts
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (run) run();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
```

`apps/api/src/supercell/client.ts`:
```ts
import { DEFAULT_COOLDOWN_SECONDS } from '../cache/policies';
import { AppError } from '../errors';
import type { Logger } from '../logger';
import { createLimiter } from './limiter';
import type { SupercellApi } from './types';

export interface SupercellClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxConcurrent?: number;
  retryDelayMs?: number;
  logger?: Logger;
}

/** Marca un fallo transitorio (red, timeout, 5xx) que merece un reintento. */
class Retryable {
  constructor(readonly error: AppError) {}
}

function parseRetryAfter(value: string | null): number {
  const n = value === null ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COOLDOWN_SECONDS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createSupercellClient(opts: SupercellClientOptions): SupercellApi {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retryDelayMs = opts.retryDelayMs ?? 300;
  const limit = createLimiter(opts.maxConcurrent ?? 8);

  async function once<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new Retryable(new AppError('UPSTREAM_UNAVAILABLE', undefined, { cause }));
    }

    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch (cause) {
        throw new AppError('UPSTREAM_UNAVAILABLE', undefined, { cause });
      }
    }

    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    if (res.status === 404) throw new AppError('NOT_FOUND');
    if (res.status === 429) {
      throw new AppError('UPSTREAM_RATE_LIMITED', undefined, {
        retryAfter: parseRetryAfter(res.headers.get('retry-after')),
      });
    }
    if (res.status === 503 && body.reason === 'inMaintenance') throw new AppError('UPSTREAM_MAINTENANCE');
    if (res.status === 403) {
      opts.logger?.error(
        { status: 403, reason: body.reason, path },
        'Supercell rechazó la petición: ¿key inválida o IP no autorizada?',
      );
      throw new AppError('UPSTREAM_UNAVAILABLE');
    }
    if (res.status >= 500) throw new Retryable(new AppError('UPSTREAM_UNAVAILABLE'));
    throw new AppError('UPSTREAM_UNAVAILABLE');
  }

  function request<T>(path: string): Promise<T> {
    return limit(async () => {
      try {
        return await once<T>(path);
      } catch (e) {
        if (!(e instanceof Retryable)) throw e;
        await sleep(retryDelayMs + Math.random() * 200 * Math.sign(retryDelayMs));
        try {
          return await once<T>(path);
        } catch (e2) {
          throw e2 instanceof Retryable ? e2.error : e2;
        }
      }
    });
  }

  const tagPath = (tag: string) => `%23${tag}`;

  return {
    mode: 'live',
    getPlayer: (tag) => request(`/players/${tagPath(tag)}`),
    getBattleLog: (tag) => request(`/players/${tagPath(tag)}/battlelog`),
    getClub: (tag) => request(`/clubs/${tagPath(tag)}`),
    getPlayerRankings: (region, n) => request(`/rankings/${region}/players?limit=${n}`),
    getClubRankings: (region, n) => request(`/rankings/${region}/clubs?limit=${n}`),
    getBrawlerRankings: (region, id, n) => request(`/rankings/${region}/brawlers/${id}?limit=${n}`),
    getBrawlers: () => request('/brawlers'),
    getEventRotation: () => request('/events/rotation'),
  };
}
```

Nota: `Math.sign(retryDelayMs)` hace que el jitter sea 0 cuando los tests pasan `retryDelayMs: 0`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- supercell-client && npm run typecheck -w @brawlwiki/api`
Expected: PASS (14 tests), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/supercell apps/api/test/helpers.ts apps/api/test/supercell-client.test.ts
git commit -m "feat(api): cliente de Supercell con timeout, reintento, límite de concurrencia y mapeo de errores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `api`: modo fixtures (`SUPERCELL_MOCK=1`)

**Files:**
- Create: `apps/api/src/supercell/fixtures.ts`
- Create: `apps/api/src/supercell/fixtures/player-2PP.json`, `player-8QU.json`, `battlelog-2PP.json`, `club-2YPLQ.json`, `club-8CGRV.json`, `rankings-players.json`, `rankings-clubs.json`, `brawlers.json`, `events.json`
- Test: `apps/api/test/supercell-fixtures.test.ts`

**Interfaces:**
- Consumes: `SupercellApi` y los tipos crudos (Task 5), `AppError` (Task 3).
- Produces:
  - `createFixtureClient(opts?: { slowMs?: number }): SupercellApi` (`mode: 'mock'`)
  - Tags de fixtures: jugadores `2PP` (con club `2YPLQ`) y `8QU` (sin club); clubes `2YPLQ` y `8CGRV`; escenarios `RRRR` (429, `retryAfter` 10), `LLLL` (mantenimiento) y `GGGG` (responde como `2PP` tras `slowMs`, 4000 por defecto). Cualquier otro tag da `NOT_FOUND`.

- [ ] **Step 1: Crear los fixtures JSON**

`apps/api/src/supercell/fixtures/player-2PP.json`:
```json
{
  "tag": "#2PP",
  "name": "EzyPlayer",
  "nameColor": "0xffffd700",
  "icon": { "id": 28000000 },
  "trophies": 42310,
  "highestTrophies": 43002,
  "expLevel": 187,
  "expPoints": 190000,
  "3vs3Victories": 3412,
  "soloVictories": 612,
  "duoVictories": 300,
  "club": { "tag": "#2YPLQ", "name": "Los Cracks" },
  "brawlers": [
    { "id": 16000000, "name": "SHELLY", "power": 11, "rank": 30, "trophies": 900, "highestTrophies": 950,
      "gadgets": [{ "id": 23000255, "name": "FAST FORWARD" }], "starPowers": [{ "id": 23000076, "name": "SHELL SHOCK" }],
      "gears": [{ "id": 62000000, "name": "SPEED", "level": 3 }] },
    { "id": 16000001, "name": "COLT", "power": 9, "rank": 25, "trophies": 750, "highestTrophies": 800,
      "gadgets": [], "starPowers": [], "gears": [] },
    { "id": 16000002, "name": "BULL", "power": 11, "rank": 35, "trophies": 1000, "highestTrophies": 1000,
      "gadgets": [{ "id": 23000272, "name": "T-BONE INJECTOR" }], "starPowers": [], "gears": [] },
    { "id": 16000003, "name": "BROCK", "power": 7, "rank": 20, "trophies": 500, "highestTrophies": 620,
      "gadgets": [], "starPowers": [], "gears": [] }
  ]
}
```

`apps/api/src/supercell/fixtures/player-8QU.json`:
```json
{
  "tag": "#8QU",
  "name": "SinClub",
  "icon": { "id": 28000001 },
  "trophies": 1200,
  "highestTrophies": 1300,
  "expLevel": 20,
  "3vs3Victories": 100,
  "soloVictories": 10,
  "duoVictories": 5,
  "club": {},
  "brawlers": [
    { "id": 16000000, "name": "SHELLY", "power": 3, "rank": 8, "trophies": 120, "highestTrophies": 150 }
  ]
}
```

`apps/api/src/supercell/fixtures/battlelog-2PP.json`: los cuatro ítems cubren 3vs3 con star player, derrota, showdown solo (`players` + `rank`) y duelo (`brawlers[]`, evento sin mapa).
```json
{
  "items": [
    {
      "battleTime": "20260929T115500.000Z",
      "event": { "id": 15000026, "mode": "gemGrab", "map": "Hard Rock Mine" },
      "battle": {
        "mode": "gemGrab", "type": "ranked", "result": "victory", "duration": 121, "trophyChange": 8,
        "starPlayer": { "tag": "#2PP", "name": "EzyPlayer", "brawler": { "id": 16000000, "name": "SHELLY", "power": 11, "trophies": 900 } },
        "teams": [
          [
            { "tag": "#2PP", "name": "EzyPlayer", "brawler": { "id": 16000000, "name": "SHELLY", "power": 11, "trophies": 900 } },
            { "tag": "#8QU", "name": "SinClub", "brawler": { "id": 16000001, "name": "COLT", "power": 3, "trophies": 120 } },
            { "tag": "#Y2YY", "name": "Aliado", "brawler": { "id": 16000002, "name": "BULL", "power": 9, "trophies": 700 } }
          ],
          [
            { "tag": "#PPP", "name": "Rival1", "brawler": { "id": 16000003, "name": "BROCK", "power": 10, "trophies": 880 } },
            { "tag": "#QQQ", "name": "Rival2", "brawler": { "id": 16000000, "name": "SHELLY", "power": 11, "trophies": 910 } },
            { "tag": "#LLQ", "name": "Rival3", "brawler": { "id": 16000001, "name": "COLT", "power": 11, "trophies": 870 } }
          ]
        ]
      }
    },
    {
      "battleTime": "20260929T114300.000Z",
      "event": { "id": 15000048, "mode": "brawlBall", "map": "Super Beach" },
      "battle": {
        "mode": "brawlBall", "type": "ranked", "result": "defeat", "duration": 150, "trophyChange": -6,
        "starPlayer": null,
        "teams": [
          [ { "tag": "#2PP", "name": "EzyPlayer", "brawler": { "id": 16000002, "name": "BULL", "power": 11, "trophies": 1000 } } ],
          [ { "tag": "#PPP", "name": "Rival1", "brawler": { "id": 16000003, "name": "BROCK", "power": 10, "trophies": 880 } } ]
        ]
      }
    },
    {
      "battleTime": "20260929T113500.000Z",
      "event": { "id": 15000011, "mode": "soloShowdown", "map": "Skull Creek" },
      "battle": {
        "mode": "soloShowdown", "type": "ranked", "rank": 2, "trophyChange": 9,
        "players": [
          { "tag": "#2PP", "name": "EzyPlayer", "brawler": { "id": 16000000, "name": "SHELLY", "power": 11, "trophies": 900 } },
          { "tag": "#QQQ", "name": "Rival2", "brawler": { "id": 16000001, "name": "COLT", "power": 11, "trophies": 910 } }
        ]
      }
    },
    {
      "battleTime": "20260929T112000.000Z",
      "event": { "id": 0 },
      "battle": {
        "mode": "duels", "type": "friendly", "result": "victory", "duration": 95,
        "players": [
          { "tag": "#2PP", "name": "EzyPlayer", "brawlers": [
            { "id": 16000000, "name": "SHELLY", "power": 11, "trophies": 900 },
            { "id": 16000002, "name": "BULL", "power": 11, "trophies": 1000 }
          ] },
          { "tag": "#PPP", "name": "Rival1", "brawlers": [
            { "id": 16000003, "name": "BROCK", "power": 10, "trophies": 880 }
          ] }
        ]
      }
    }
  ],
  "paging": { "cursors": {} }
}
```

`apps/api/src/supercell/fixtures/club-2YPLQ.json`:
```json
{
  "tag": "#2YPLQ",
  "name": "Los Cracks",
  "description": "Club de prueba. ¡Activos diario!",
  "type": "inviteOnly",
  "badgeId": 8000000,
  "requiredTrophies": 25000,
  "trophies": 1020000,
  "members": [
    { "tag": "#2PP", "name": "EzyPlayer", "nameColor": "0xffffd700", "role": "president", "trophies": 42310, "icon": { "id": 28000000 } },
    { "tag": "#Y2YY", "name": "Mika", "role": "vicePresident", "trophies": 40100, "icon": { "id": 28000002 } },
    { "tag": "#8QU", "name": "SinClub", "role": "member", "trophies": 1200, "icon": { "id": 28000001 } }
  ]
}
```

`apps/api/src/supercell/fixtures/club-8CGRV.json`:
```json
{
  "tag": "#8CGRV",
  "name": "Titanes",
  "description": "",
  "type": "open",
  "badgeId": 8000010,
  "requiredTrophies": 30000,
  "trophies": 940000,
  "members": [
    { "tag": "#QQQ", "name": "Rival2", "role": "president", "trophies": 45000, "icon": { "id": 28000003 } },
    { "tag": "#PPP", "name": "Rival1", "role": "member", "trophies": 38000, "icon": { "id": 28000004 } }
  ]
}
```

`apps/api/src/supercell/fixtures/rankings-players.json`:
```json
{
  "items": [
    { "tag": "#YYYY", "name": "xXProXx", "nameColor": "0xffff8afb", "icon": { "id": 28000010 }, "trophies": 98410, "rank": 1, "club": { "name": "Tribe" } },
    { "tag": "#QQQ", "name": "Rival2", "icon": { "id": 28000003 }, "trophies": 97022, "rank": 2, "club": { "name": "Titanes" } },
    { "tag": "#LLLQ", "name": "SoloPro", "icon": { "id": 28000011 }, "trophies": 96870, "rank": 3 }
  ],
  "paging": { "cursors": {} }
}
```

`apps/api/src/supercell/fixtures/rankings-clubs.json`:
```json
{
  "items": [
    { "tag": "#2YPLQ", "name": "Los Cracks", "badgeId": 8000000, "trophies": 1020000, "rank": 1, "memberCount": 30 },
    { "tag": "#8CGRV", "name": "Titanes", "badgeId": 8000010, "trophies": 940000, "rank": 2, "memberCount": 27 }
  ],
  "paging": { "cursors": {} }
}
```

`apps/api/src/supercell/fixtures/brawlers.json`:
```json
{
  "items": [
    { "id": 16000000, "name": "SHELLY", "starPowers": [{ "id": 23000076, "name": "SHELL SHOCK" }], "gadgets": [{ "id": 23000255, "name": "FAST FORWARD" }] },
    { "id": 16000001, "name": "COLT", "starPowers": [], "gadgets": [] },
    { "id": 16000002, "name": "BULL", "starPowers": [], "gadgets": [{ "id": 23000272, "name": "T-BONE INJECTOR" }] },
    { "id": 16000003, "name": "BROCK", "starPowers": [], "gadgets": [] }
  ],
  "paging": { "cursors": {} }
}
```

`apps/api/src/supercell/fixtures/events.json`:
```json
[
  { "startTime": "20260929T080000.000Z", "endTime": "20260930T080000.000Z", "slotId": 1,
    "event": { "id": 15000026, "mode": "gemGrab", "map": "Hard Rock Mine" } },
  { "startTime": "20260929T100000.000Z", "endTime": "20260929T180000.000Z", "slotId": 2,
    "event": { "id": 15000048, "mode": "brawlBall", "map": "Super Beach" } }
]
```

- [ ] **Step 2: Escribir el test que falla**

`apps/api/test/supercell-fixtures.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createFixtureClient } from '../src/supercell/fixtures';

describe('createFixtureClient', () => {
  const c = createFixtureClient({ slowMs: 15 });

  it('mode es mock', () => {
    expect(c.mode).toBe('mock');
  });

  it('devuelve jugadores y clubes conocidos', async () => {
    expect((await c.getPlayer('2PP')).name).toBe('EzyPlayer');
    expect((await c.getPlayer('8QU')).club).toEqual({});
    expect((await c.getClub('2YPLQ')).name).toBe('Los Cracks');
    expect((await c.getClub('8CGRV')).name).toBe('Titanes');
  });

  it('battle log de 2PP tiene 4 partidas y el de 8QU está vacío', async () => {
    expect((await c.getBattleLog('2PP')).items).toHaveLength(4);
    expect((await c.getBattleLog('8QU')).items).toEqual([]);
  });

  it('tag desconocido → NOT_FOUND', async () => {
    await expect(c.getPlayer('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(c.getClub('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('escenarios RRRR y LLLL', async () => {
    await expect(c.getPlayer('RRRR')).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED', retryAfter: 10 });
    await expect(c.getClub('LLLL')).rejects.toMatchObject({ code: 'UPSTREAM_MAINTENANCE' });
  });

  it('GGGG responde como 2PP pero tras slowMs', async () => {
    const t0 = Date.now();
    const p = await c.getPlayer('GGGG');
    expect(Date.now() - t0).toBeGreaterThanOrEqual(14);
    expect(p.tag).toBe('#GGGG');
  });

  it('rankings, brawlers y eventos', async () => {
    expect((await c.getPlayerRankings('MX', 50)).items).toHaveLength(3);
    expect((await c.getBrawlerRankings('global', 16000000, 50)).items).toHaveLength(3);
    expect((await c.getClubRankings('global', 50)).items).toHaveLength(2);
    expect((await c.getBrawlers()).items).toHaveLength(4);
    expect(await c.getEventRotation()).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- supercell-fixtures`
Expected: FAIL, "Failed to resolve import ../src/supercell/fixtures".

- [ ] **Step 4: Implementar**

`apps/api/src/supercell/fixtures.ts`:
```ts
import { readFileSync } from 'node:fs';
import { AppError } from '../errors';
import type { RawBattleLog, RawClub, RawPlayer, SupercellApi } from './types';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as T;
}

const PLAYERS = new Set(['2PP', '8QU']);
const CLUBS = new Set(['2YPLQ', '8CGRV']);
const BATTLELOGS = new Set(['2PP']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cliente falso para tests, E2E y desarrollo sin key. Ver la tabla de tags en la spec (sección 3). */
export function createFixtureClient(opts: { slowMs?: number } = {}): SupercellApi {
  const slowMs = opts.slowMs ?? 4000;

  async function scenario(tag: string): Promise<string> {
    if (tag === 'RRRR') throw new AppError('UPSTREAM_RATE_LIMITED', undefined, { retryAfter: 10 });
    if (tag === 'LLLL') throw new AppError('UPSTREAM_MAINTENANCE');
    if (tag === 'GGGG') {
      await sleep(slowMs);
      return '2PP';
    }
    return tag;
  }

  return {
    mode: 'mock',
    async getPlayer(tag) {
      const source = await scenario(tag);
      if (!PLAYERS.has(source)) throw new AppError('NOT_FOUND');
      return { ...load<RawPlayer>(`player-${source}`), tag: `#${tag}` };
    },
    async getBattleLog(tag) {
      const source = await scenario(tag);
      if (!PLAYERS.has(source)) throw new AppError('NOT_FOUND');
      return BATTLELOGS.has(source) ? load<RawBattleLog>(`battlelog-${source}`) : { items: [] };
    },
    async getClub(tag) {
      const source = await scenario(tag);
      if (!CLUBS.has(source)) throw new AppError('NOT_FOUND');
      return load<RawClub>(`club-${source}`);
    },
    getPlayerRankings: async () => load('rankings-players'),
    getClubRankings: async () => load('rankings-clubs'),
    getBrawlerRankings: async () => load('rankings-players'),
    getBrawlers: async () => load('brawlers'),
    getEventRotation: async () => load('events'),
  };
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- supercell-fixtures && npm run typecheck -w @brawlwiki/api`
Expected: PASS (7 tests), typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/supercell/fixtures.ts apps/api/src/supercell/fixtures apps/api/test/supercell-fixtures.test.ts
git commit -m "feat(api): cliente de fixtures con tags de escenario (429, mantenimiento, lento)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `api`: `cachedFetch` (fresco/stale, dedupe, caché negativa, cooldown)

**Files:**
- Create: `apps/api/src/cache/cached-fetch.ts`
- Test: `apps/api/test/cached-fetch.test.ts`

**Interfaces:**
- Consumes: `Cache`, `createMemoryCache` (Task 4), `CachePolicy`, `NEGATIVE_TTL_SECONDS`, `DEFAULT_COOLDOWN_SECONDS` (Task 4), `AppError`, `isAppError`, `UPSTREAM_CODES` (Task 3), `DataResult` (Task 3), `Logger` (Task 3).
- Produces:
  - `interface CacheEntry<T> { data: T; fetchedAt: number }`
  - `interface FetchOptions { beforeUpstream?: () => void }`. Se llama justo antes de pedir a Supercell, solo en el request "líder"; si lanza, se trata como error upstream.
  - `type CachedFetch = <T>(key: string, policy: CachePolicy, fetcher: () => Promise<T>, options?: FetchOptions) => Promise<DataResult<T>>`
  - `createCachedFetch(deps: { cache: Cache; now?: () => number; logger?: Logger }): { cachedFetch: CachedFetch; isCoolingDown(): Promise<boolean> }`
  - `COOLDOWN_KEY = 'cooldown:supercell'`

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/cached-fetch.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cache } from '../src/cache/cache';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { AppError } from '../src/errors';

const POLICY = { freshTtl: 60, staleTtl: 3600 };
let t: number;
let cache: Cache;
let cf: ReturnType<typeof createCachedFetch>;

beforeEach(() => {
  t = 1_000_000;
  cache = createMemoryCache({ now: () => t });
  cf = createCachedFetch({ cache, now: () => t });
});

const fail = (code: ConstructorParameters<typeof AppError>[0], retryAfter?: number) =>
  vi.fn(async () => {
    throw new AppError(code, undefined, retryAfter === undefined ? {} : { retryAfter });
  });

describe('cachedFetch', () => {
  it('sin dato → llama al fetcher y responde fresh', async () => {
    const fetcher = vi.fn(async () => 'A');
    await expect(cf.cachedFetch('k', POLICY, fetcher)).resolves.toEqual({ data: 'A', source: 'fresh', fetchedAt: t });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('dentro de freshTtl → responde cache sin llamar al fetcher', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    const fetchedAt = t;
    t += 59_000;
    const fetcher = vi.fn(async () => 'B');
    await expect(cf.cachedFetch('k', POLICY, fetcher)).resolves.toEqual({ data: 'A', source: 'cache', fetchedAt });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('vencido y Supercell ok → fresh con dato nuevo', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    t += 61_000;
    await expect(cf.cachedFetch('k', POLICY, async () => 'B')).resolves.toMatchObject({ data: 'B', source: 'fresh' });
  });

  it('vencido y Supercell caído → stale con el fetchedAt original', async () => {
    await cf.cachedFetch('k', POLICY, async () => 'A');
    const fetchedAt = t;
    t += 61_000;
    for (const code of ['UPSTREAM_UNAVAILABLE', 'UPSTREAM_MAINTENANCE'] as const) {
      await expect(cf.cachedFetch('k', POLICY, fail(code))).resolves.toEqual({ data: 'A', source: 'stale', fetchedAt });
    }
  });

  it('sin dato y Supercell caído → propaga el error', async () => {
    await expect(cf.cachedFetch('k', POLICY, fail('UPSTREAM_UNAVAILABLE'))).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });

  it('NOT_FOUND se cachea 60s como negativo', async () => {
    const f1 = fail('NOT_FOUND');
    await expect(cf.cachedFetch('k', POLICY, f1)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const f2 = vi.fn(async () => 'A');
    await expect(cf.cachedFetch('k', POLICY, f2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f2).not.toHaveBeenCalled();
    t += 60_000;
    await expect(cf.cachedFetch('k', POLICY, f2)).resolves.toMatchObject({ data: 'A' });
  });

  it('dedupe: dos pedidos simultáneos → una sola llamada upstream', async () => {
    let release!: (v: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((r) => (release = r)));
    const a = cf.cachedFetch('k', POLICY, fetcher);
    const b = cf.cachedFetch('k', POLICY, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    release('A');
    await expect(Promise.all([a, b])).resolves.toEqual([
      { data: 'A', source: 'fresh', fetchedAt: t },
      { data: 'A', source: 'fresh', fetchedAt: t },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('429 activa cooldown: no se llama a Supercell y se sirve stale o error', async () => {
    await cf.cachedFetch('conDato', POLICY, async () => 'A');
    t += 61_000;
    await expect(cf.cachedFetch('otro', POLICY, fail('UPSTREAM_RATE_LIMITED', 30))).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
    });
    expect(await cf.isCoolingDown()).toBe(true);

    const fetcher = vi.fn(async () => 'B');
    await expect(cf.cachedFetch('conDato', POLICY, fetcher)).resolves.toMatchObject({ data: 'A', source: 'stale' });
    await expect(cf.cachedFetch('sinDato', POLICY, fetcher)).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
      retryAfter: 30,
    });
    expect(fetcher).not.toHaveBeenCalled();

    t += 30_000;
    expect(await cf.isCoolingDown()).toBe(false);
    await expect(cf.cachedFetch('sinDato', POLICY, fetcher)).resolves.toMatchObject({ data: 'B', source: 'fresh' });
  });

  it('beforeUpstream: no se llama en un acierto de caché; si lanza RATE_LIMITED se sirve stale o se propaga', async () => {
    const guard = vi.fn(() => {
      throw new AppError('RATE_LIMITED', undefined, { retryAfter: 5 });
    });
    await expect(cf.cachedFetch('k', POLICY, async () => 'A', { beforeUpstream: guard })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await cf.cachedFetch('k', POLICY, async () => 'A');
    guard.mockClear();
    await cf.cachedFetch('k', POLICY, async () => 'B', { beforeUpstream: guard });
    expect(guard).not.toHaveBeenCalled();
    t += 61_000;
    await expect(cf.cachedFetch('k', POLICY, async () => 'B', { beforeUpstream: guard })).resolves.toMatchObject({
      data: 'A',
      source: 'stale',
    });
  });

  it('caché rota (get/set lanzan) → se trata como vacía y responde fresh', async () => {
    const broken: Cache = {
      kind: 'redis',
      get: async () => {
        throw new Error('ECONNREFUSED');
      },
      set: async () => {
        throw new Error('ECONNREFUSED');
      },
      del: async () => undefined,
    };
    const warn = vi.fn();
    const c = createCachedFetch({ cache: broken, now: () => t, logger: { warn } as never });
    await expect(c.cachedFetch('k', POLICY, async () => 'A')).resolves.toMatchObject({ data: 'A', source: 'fresh' });
    expect(warn).toHaveBeenCalled();
  });

  it('entrada con forma basura → se trata como vacía', async () => {
    await cache.set('k', 'no-soy-una-entrada', 3600);
    await expect(cf.cachedFetch('k', POLICY, async () => 'A')).resolves.toMatchObject({ data: 'A', source: 'fresh' });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- cached-fetch`
Expected: FAIL, "Failed to resolve import ../src/cache/cached-fetch".

- [ ] **Step 3: Implementar**

`apps/api/src/cache/cached-fetch.ts`:
```ts
import { AppError, isAppError, UPSTREAM_CODES } from '../errors';
import type { Logger } from '../logger';
import type { DataResult } from '../types';
import type { Cache } from './cache';
import { type CachePolicy, DEFAULT_COOLDOWN_SECONDS, NEGATIVE_TTL_SECONDS } from './policies';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export interface FetchOptions {
  /** Se llama justo antes de consultar a Supercell (solo en el request líder). Puede lanzar AppError. */
  beforeUpstream?: () => void;
}

export type CachedFetch = <T>(
  key: string,
  policy: CachePolicy,
  fetcher: () => Promise<T>,
  options?: FetchOptions,
) => Promise<DataResult<T>>;

export const COOLDOWN_KEY = 'cooldown:supercell';

function isEntry(x: unknown): x is CacheEntry<unknown> {
  return typeof x === 'object' && x !== null && 'data' in x && typeof (x as { fetchedAt?: unknown }).fetchedAt === 'number';
}

export function createCachedFetch(deps: { cache: Cache; now?: () => number; logger?: Pick<Logger, 'warn'> }) {
  const { cache, logger } = deps;
  const now = deps.now ?? Date.now;
  const inflight = new Map<string, Promise<DataResult<unknown>>>();

  async function safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await cache.get<T>(key);
    } catch (err) {
      logger?.warn({ err, key }, 'caché no disponible (lectura)');
      return undefined;
    }
  }

  async function safeSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await cache.set(key, value, ttlSeconds);
    } catch (err) {
      logger?.warn({ err, key }, 'caché no disponible (escritura)');
    }
  }

  async function cooldownRemaining(): Promise<number> {
    const until = await safeGet<number>(COOLDOWN_KEY);
    return typeof until === 'number' ? Math.max(0, until - now()) : 0;
  }

  async function resolveUpstream<T>(
    key: string,
    policy: CachePolicy,
    fetcher: () => Promise<T>,
    entry: CacheEntry<T> | undefined,
    options: FetchOptions,
  ): Promise<DataResult<T>> {
    const stale = (): DataResult<T> | undefined =>
      entry ? { data: entry.data, source: 'stale', fetchedAt: entry.fetchedAt } : undefined;

    const remaining = await cooldownRemaining();
    if (remaining > 0) {
      const s = stale();
      if (s) return s;
      throw new AppError('UPSTREAM_RATE_LIMITED', undefined, { retryAfter: Math.ceil(remaining / 1000) });
    }

    try {
      options.beforeUpstream?.();
      const data = await fetcher();
      const fetchedAt = now();
      await safeSet(key, { data, fetchedAt } satisfies CacheEntry<T>, policy.staleTtl);
      return { data, source: 'fresh', fetchedAt };
    } catch (err) {
      if (!isAppError(err)) throw err;
      if (err.code === 'NOT_FOUND') {
        await safeSet(`404:${key}`, 1, NEGATIVE_TTL_SECONDS);
        throw err;
      }
      if (err.code === 'UPSTREAM_RATE_LIMITED') {
        const seconds = err.retryAfter ?? DEFAULT_COOLDOWN_SECONDS;
        await safeSet(COOLDOWN_KEY, now() + seconds * 1000, seconds);
      }
      if (UPSTREAM_CODES.has(err.code) || err.code === 'RATE_LIMITED') {
        const s = stale();
        if (s) return s;
      }
      throw err;
    }
  }

  const cachedFetch: CachedFetch = async (key, policy, fetcher, options = {}) => {
    if (await safeGet(`404:${key}`)) throw new AppError('NOT_FOUND');

    const raw = await safeGet<unknown>(key);
    const entry = isEntry(raw) ? (raw as CacheEntry<never>) : undefined;
    if (entry && now() - entry.fetchedAt < policy.freshTtl * 1000) {
      return { data: entry.data, source: 'cache', fetchedAt: entry.fetchedAt };
    }

    const pending = inflight.get(key);
    if (pending) return pending as never;

    const p = resolveUpstream(key, policy, fetcher, entry, options).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };

  return {
    cachedFetch,
    isCoolingDown: async () => (await cooldownRemaining()) > 0,
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- cached-fetch && npm run typecheck -w @brawlwiki/api`
Expected: PASS (11 tests), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cache/cached-fetch.ts apps/api/test/cached-fetch.test.ts
git commit -m "feat(api): cachedFetch con fallback stale, dedupe, caché negativa y cooldown por 429

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `api`: assets (URLs del CDN y metadatos de brawlers)

**Files:**
- Create: `apps/api/src/assets/urls.ts`, `apps/api/src/assets/brawler-meta.ts`, `apps/api/src/assets/brawler-meta.json`
- Create: `apps/api/scripts/import-brawler-meta.ts`
- Test: `apps/api/test/assets.test.ts`

**Interfaces:**
- Consumes: `Rarity` de `@brawlwiki/shared`.
- Produces:
  - `CDN_BASE = 'https://cdn.brawlify.com'`
  - `brawlerImageUrl(id: number): string`, `profileIconUrl(id: number): string`, `clubBadgeUrl(id: number): string`
  - `mapImageUrl(id: number | null | undefined): string | null` (`null` si `id` es falsy)
  - `interface BrawlerMeta { rarity: Rarity | null; class: string | null }`, `type BrawlerMetaMap = Record<string, BrawlerMeta>`
  - `loadBrawlerMeta(): BrawlerMetaMap` (lee el JSON una sola vez)
  - `getBrawlerMeta(id: number, map?: BrawlerMetaMap): BrawlerMeta` (`{ rarity: null, class: null }` si no está)
  - `convertBrawlifyBrawlers(json: unknown): BrawlerMetaMap` (lanza `Error` si no tiene la forma `{ list: [...] }`)

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/assets.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { convertBrawlifyBrawlers, getBrawlerMeta, loadBrawlerMeta } from '../src/assets/brawler-meta';
import { brawlerImageUrl, clubBadgeUrl, mapImageUrl, profileIconUrl } from '../src/assets/urls';

describe('urls del CDN', () => {
  it('siguen los patrones verificados', () => {
    expect(brawlerImageUrl(16000000)).toBe('https://cdn.brawlify.com/brawlers/borderless/16000000.png');
    expect(profileIconUrl(28000000)).toBe('https://cdn.brawlify.com/profile-icons/regular/28000000.png');
    expect(mapImageUrl(15000026)).toBe('https://cdn.brawlify.com/maps/regular/15000026.png');
    expect(clubBadgeUrl(8000000)).toBe('https://cdn.brawlify.com/club-badges/regular/8000000.png');
  });

  it('mapa sin id → null', () => {
    expect(mapImageUrl(0)).toBeNull();
    expect(mapImageUrl(undefined)).toBeNull();
    expect(mapImageUrl(null)).toBeNull();
  });
});

describe('brawler meta', () => {
  const map = { '16000001': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Damage Dealer' } };

  it('devuelve la meta conocida', () => {
    expect(getBrawlerMeta(16000001, map)).toEqual(map['16000001']);
  });

  it('brawler desconocido → rarity y class null', () => {
    expect(getBrawlerMeta(16000999, map)).toEqual({ rarity: null, class: null });
  });

  it('loadBrawlerMeta lee el JSON del repo', () => {
    expect(typeof loadBrawlerMeta()).toBe('object');
  });

  it('convertBrawlifyBrawlers convierte la forma de Brawlify /v1/brawlers', () => {
    const json = {
      list: [
        { id: 16000001, name: 'Colt', rarity: { id: 2, name: 'Rare', color: '#68fd58' }, class: { id: 2, name: 'Damage Dealer' } },
        { id: 16000099, name: 'Nuevo', rarity: null, class: null },
        { name: 'sin id' },
      ],
    };
    expect(convertBrawlifyBrawlers(json)).toEqual({
      '16000001': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Damage Dealer' },
      '16000099': { rarity: null, class: null },
    });
  });

  it('convertBrawlifyBrawlers rechaza JSON con otra forma', () => {
    expect(() => convertBrawlifyBrawlers({ items: [] })).toThrow('{ list: [...] }');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- assets`
Expected: FAIL, "Failed to resolve import ../src/assets/brawler-meta".

- [ ] **Step 3: Implementar**

`apps/api/src/assets/urls.ts`:
```ts
/** Patrones del CDN de Brawlify, verificados el 2026-09-29. Un ID inexistente devuelve 404: el frontend muestra un fallback. */
export const CDN_BASE = 'https://cdn.brawlify.com';

export const brawlerImageUrl = (id: number): string => `${CDN_BASE}/brawlers/borderless/${id}.png`;
export const profileIconUrl = (id: number): string => `${CDN_BASE}/profile-icons/regular/${id}.png`;
export const clubBadgeUrl = (id: number): string => `${CDN_BASE}/club-badges/regular/${id}.png`;
export const mapImageUrl = (id: number | null | undefined): string | null =>
  id ? `${CDN_BASE}/maps/regular/${id}.png` : null;
```

`apps/api/src/assets/brawler-meta.json`:
```json
{}
```

`apps/api/src/assets/brawler-meta.ts`:
```ts
import { readFileSync } from 'node:fs';
import type { Rarity } from '@brawlwiki/shared';

export interface BrawlerMeta {
  rarity: Rarity | null;
  class: string | null;
}
export type BrawlerMetaMap = Record<string, BrawlerMeta>;

const NONE: BrawlerMeta = { rarity: null, class: null };
let loaded: BrawlerMetaMap | undefined;

export function loadBrawlerMeta(): BrawlerMetaMap {
  loaded ??= JSON.parse(readFileSync(new URL('./brawler-meta.json', import.meta.url), 'utf8')) as BrawlerMetaMap;
  return loaded;
}

export function getBrawlerMeta(id: number, map: BrawlerMetaMap = loadBrawlerMeta()): BrawlerMeta {
  return map[String(id)] ?? NONE;
}

interface BrawlifyBrawler {
  id?: unknown;
  rarity?: { name?: string; color?: string } | null;
  class?: { name?: string } | null;
}

/** Convierte el JSON de https://api.brawlify.com/v1/brawlers (descargado desde el navegador) a nuestro mapa. */
export function convertBrawlifyBrawlers(json: unknown): BrawlerMetaMap {
  const list = (json as { list?: unknown } | null)?.list;
  if (!Array.isArray(list)) {
    throw new Error('El JSON no tiene la forma { list: [...] } de Brawlify /v1/brawlers');
  }
  const out: BrawlerMetaMap = {};
  for (const b of list as BrawlifyBrawler[]) {
    if (typeof b.id !== 'number') continue;
    out[String(b.id)] = {
      rarity: b.rarity?.name && b.rarity.color ? { name: b.rarity.name, color: b.rarity.color } : null,
      class: b.class?.name ?? null,
    };
  }
  return out;
}
```

`apps/api/scripts/import-brawler-meta.ts`:
```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertBrawlifyBrawlers } from '../src/assets/brawler-meta';

const input = process.argv[2];
if (!input) {
  console.error('Uso: npm run meta:import -w @brawlwiki/api -- <ruta ABSOLUTA a brawlers.json de Brawlify>');
  process.exit(1);
}

const meta = convertBrawlifyBrawlers(JSON.parse(readFileSync(resolve(input), 'utf8')));
const out = new URL('../src/assets/brawler-meta.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`brawler-meta.json actualizado: ${Object.keys(meta).length} brawlers`);
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- assets && npm run typecheck -w @brawlwiki/api`
Expected: PASS (7 tests), typecheck limpio.

- [ ] **Step 5: Verificar el script a mano**

Run:
```bash
echo '{"list":[{"id":16000001,"rarity":{"name":"Rare","color":"#68fd58"},"class":{"name":"Damage Dealer"}}]}' > "$TMP/bf.json"
npm run meta:import -w @brawlwiki/api -- "$TMP/bf.json" && cat apps/api/src/assets/brawler-meta.json
git checkout apps/api/src/assets/brawler-meta.json 2>/dev/null || echo '{}' > apps/api/src/assets/brawler-meta.json
```
Expected: imprime `brawler-meta.json actualizado: 1 brawlers` y el JSON con la entrada `16000001`. Después el archivo vuelve a `{}` (el `git checkout` falla porque el archivo aún no tiene commit y entra el `echo`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/assets apps/api/scripts apps/api/test/assets.test.ts
git commit -m "feat(api): URLs del CDN de Brawlify y metadatos de rareza/clase con script de importación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `api`: mappers de Supercell a DTOs

**Files:**
- Create: `apps/api/src/mappers/common.ts`, `player.ts`, `battle.ts`, `club.ts`, `rankings.ts`, `brawler.ts`, `event.ts` (todos en `apps/api/src/mappers/`)
- Test: `apps/api/test/mappers.test.ts`

**Interfaces:**
- Consumes: tipos crudos (Task 5), `createFixtureClient` (Task 6, solo en tests), URLs y `getBrawlerMeta` / `BrawlerMetaMap` (Task 8), `parseSupercellDate` y tipos DTO de `@brawlwiki/shared` (Tasks 1-2).
- Produces:
  - `stripHash(tag: string): string`, `named(items?: RawNamed[]): NamedItem[]`
  - `toPlayer(raw: RawPlayer, meta?: BrawlerMetaMap): Player` (brawlers ordenados por trofeos, de mayor a menor)
  - `toBattles(raw: RawBattleLog): Battle[]`
  - `toClub(raw: RawClub): Club` (miembros ordenados por trofeos, de mayor a menor)
  - `toPlayerRankings(raw: RawList<RawPlayerRanking>): PlayerRanking[]`, `toClubRankings(raw: RawList<RawClubRanking>): ClubRanking[]`
  - `toBrawler(raw: RawBrawler, meta?: BrawlerMetaMap): Brawler`, `toBrawlers(raw: RawList<RawBrawler>, meta?: BrawlerMetaMap): Brawler[]` (ordenados por id)
  - `toEventSlots(raw: RawEventSlot[]): EventSlot[]`

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/mappers.test.ts`:
```ts
import {
  BattleSchema,
  BrawlerSchema,
  ClubRankingSchema,
  ClubSchema,
  EventSlotSchema,
  PlayerRankingSchema,
  PlayerSchema,
} from '@brawlwiki/shared';
import { describe, expect, it } from 'vitest';
import { toBattles } from '../src/mappers/battle';
import { toBrawlers } from '../src/mappers/brawler';
import { toClub } from '../src/mappers/club';
import { toEventSlots } from '../src/mappers/event';
import { toPlayer } from '../src/mappers/player';
import { toClubRankings, toPlayerRankings } from '../src/mappers/rankings';
import { createFixtureClient } from '../src/supercell/fixtures';

const sc = createFixtureClient();
const META = { '16000002': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Tank' } };

describe('toPlayer', () => {
  it('mapea el jugador 2PP y cumple el esquema', async () => {
    const p = toPlayer(await sc.getPlayer('2PP'), META);
    expect(PlayerSchema.parse(p)).toEqual(p);
    expect(p.tag).toBe('2PP');
    expect(p.club).toEqual({ tag: '2YPLQ', name: 'Los Cracks' });
    expect(p.victories).toEqual({ trio: 3412, duo: 300, solo: 612 });
    expect(p.icon.imageUrl).toBe('https://cdn.brawlify.com/profile-icons/regular/28000000.png');
    expect(p.brawlers.map((b) => b.name)).toEqual(['BULL', 'SHELLY', 'COLT', 'BROCK']);
    expect(p.brawlers[0]).toMatchObject({
      imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000002.png',
      rarity: { name: 'Rare', color: '#68fd58' },
      class: 'Tank',
    });
    expect(p.brawlers[1]!.gears).toEqual([{ id: 62000000, name: 'SPEED' }]);
  });

  it('jugador sin club ("club": {}) → club null; campos opcionales ausentes → vacíos', async () => {
    const p = toPlayer(await sc.getPlayer('8QU'), META);
    expect(PlayerSchema.parse(p)).toEqual(p);
    expect(p.club).toBeNull();
    expect(p.nameColor).toBeNull();
    expect(p.brawlers[0]).toMatchObject({ gadgets: [], starPowers: [], gears: [], rarity: null, class: null });
  });
});

describe('toBattles', () => {
  it('mapea 3vs3, showdown solo y duelos sin romper y cumple el esquema', async () => {
    const battles = toBattles(await sc.getBattleLog('2PP'));
    expect(battles).toHaveLength(4);
    for (const b of battles) expect(BattleSchema.parse(b)).toEqual(b);

    const [gem, ball, showdown, duel] = battles;
    expect(gem).toMatchObject({
      battleTime: '2026-09-29T11:55:00.000Z',
      mode: 'gemGrab',
      map: { id: 15000026, name: 'Hard Rock Mine', imageUrl: 'https://cdn.brawlify.com/maps/regular/15000026.png' },
      result: 'victory',
      trophyChange: 8,
      durationSeconds: 121,
      starPlayerTag: '2PP',
    });
    expect(gem!.teams.map((t) => t.length)).toEqual([3, 3]);
    expect(ball).toMatchObject({ result: 'defeat', trophyChange: -6, starPlayerTag: null });

    expect(showdown).toMatchObject({ mode: 'soloShowdown', rank: 2, result: null, durationSeconds: null });
    expect(showdown!.teams).toHaveLength(2);
    expect(showdown!.teams[0]).toHaveLength(1);

    expect(duel).toMatchObject({
      mode: 'duels',
      map: { id: null, name: null, imageUrl: null },
      trophyChange: null,
      rank: null,
    });
    expect(duel!.teams[0]![0]!.brawler.name).toBe('SHELLY');
  });

  it('battle log vacío → []', async () => {
    expect(toBattles(await sc.getBattleLog('8QU'))).toEqual([]);
  });
});

describe('toClub', () => {
  it('mapea el club y ordena miembros por trofeos', async () => {
    const c = toClub(await sc.getClub('2YPLQ'));
    expect(ClubSchema.parse(c)).toEqual(c);
    expect(c.tag).toBe('2YPLQ');
    expect(c.badgeImageUrl).toBe('https://cdn.brawlify.com/club-badges/regular/8000000.png');
    expect(c.members.map((m) => m.tag)).toEqual(['2PP', 'Y2YY', '8QU']);
    expect(c.members[1]!.nameColor).toBeNull();
  });
});

describe('rankings', () => {
  it('jugadores: clubName null si no hay club', async () => {
    const r = toPlayerRankings(await sc.getPlayerRankings('global', 200));
    for (const x of r) expect(PlayerRankingSchema.parse(x)).toEqual(x);
    expect(r[0]).toMatchObject({ rank: 1, tag: 'YYYY', clubName: 'Tribe' });
    expect(r[2]!.clubName).toBeNull();
  });

  it('clubes', async () => {
    const r = toClubRankings(await sc.getClubRankings('global', 200));
    for (const x of r) expect(ClubRankingSchema.parse(x)).toEqual(x);
    expect(r[1]).toMatchObject({ rank: 2, tag: '8CGRV', memberCount: 27 });
  });
});

describe('brawlers y eventos', () => {
  it('toBrawlers agrega imagen y meta', async () => {
    const list = toBrawlers(await sc.getBrawlers(), META);
    for (const b of list) expect(BrawlerSchema.parse(b)).toEqual(b);
    expect(list.map((b) => b.id)).toEqual([16000000, 16000001, 16000002, 16000003]);
    expect(list[2]).toMatchObject({ rarity: { name: 'Rare' }, class: 'Tank' });
    expect(list[0]!.gadgets).toEqual([{ id: 23000255, name: 'FAST FORWARD' }]);
  });

  it('toEventSlots convierte fechas y deja mode.imageUrl en null', async () => {
    const slots = toEventSlots(await sc.getEventRotation());
    for (const s of slots) expect(EventSlotSchema.parse(s)).toEqual(s);
    expect(slots[0]).toMatchObject({
      slotId: 1,
      startTime: '2026-09-29T08:00:00.000Z',
      mode: { name: 'gemGrab', imageUrl: null },
      map: { id: 15000026, name: 'Hard Rock Mine' },
    });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- mappers`
Expected: FAIL, "Failed to resolve import ../src/mappers/battle".

- [ ] **Step 3: Implementar**

`apps/api/src/mappers/common.ts`:
```ts
import type { NamedItem } from '@brawlwiki/shared';
import type { RawNamed } from '../supercell/types';

export const stripHash = (tag: string): string => tag.replace(/^#/, '');

export const named = (items?: RawNamed[]): NamedItem[] => (items ?? []).map(({ id, name }) => ({ id, name }));
```

`apps/api/src/mappers/player.ts`:
```ts
import type { Player, PlayerBrawler } from '@brawlwiki/shared';
import { type BrawlerMetaMap, getBrawlerMeta } from '../assets/brawler-meta';
import { brawlerImageUrl, profileIconUrl } from '../assets/urls';
import type { RawPlayer, RawPlayerBrawler } from '../supercell/types';
import { named, stripHash } from './common';

function toPlayerBrawler(b: RawPlayerBrawler, meta?: BrawlerMetaMap): PlayerBrawler {
  const m = getBrawlerMeta(b.id, meta);
  return {
    id: b.id,
    name: b.name,
    power: b.power,
    rank: b.rank,
    trophies: b.trophies,
    highestTrophies: b.highestTrophies,
    gadgets: named(b.gadgets),
    starPowers: named(b.starPowers),
    gears: named(b.gears),
    imageUrl: brawlerImageUrl(b.id),
    rarity: m.rarity,
    class: m.class,
  };
}

export function toPlayer(raw: RawPlayer, meta?: BrawlerMetaMap): Player {
  return {
    tag: stripHash(raw.tag),
    name: raw.name,
    nameColor: raw.nameColor ?? null,
    icon: { id: raw.icon.id, imageUrl: profileIconUrl(raw.icon.id) },
    trophies: raw.trophies,
    highestTrophies: raw.highestTrophies,
    expLevel: raw.expLevel,
    victories: {
      trio: raw['3vs3Victories'] ?? 0,
      duo: raw.duoVictories ?? 0,
      solo: raw.soloVictories ?? 0,
    },
    club: raw.club?.tag && raw.club.name ? { tag: stripHash(raw.club.tag), name: raw.club.name } : null,
    brawlers: raw.brawlers.map((b) => toPlayerBrawler(b, meta)).sort((a, b) => b.trophies - a.trophies),
  };
}
```

`apps/api/src/mappers/battle.ts`:
```ts
import { type Battle, type BattlePlayer, parseSupercellDate } from '@brawlwiki/shared';
import { brawlerImageUrl, mapImageUrl } from '../assets/urls';
import type { RawBattle, RawBattleLog, RawBattlePlayer } from '../supercell/types';
import { stripHash } from './common';

function toBattlePlayer(p: RawBattlePlayer): BattlePlayer {
  // Los duelos traen `brawlers[]` en lugar de `brawler`; mostramos el primero.
  const b = p.brawler ?? p.brawlers?.[0];
  return {
    tag: stripHash(p.tag),
    name: p.name,
    brawler: b
      ? { id: b.id, name: b.name, power: b.power, trophies: b.trophies, imageUrl: brawlerImageUrl(b.id) }
      : { id: 0, name: '?', power: 0, trophies: 0, imageUrl: null },
  };
}

function toBattle(item: RawBattle): Battle {
  const b = item.battle;
  // Showdown solo y duelos traen `players` sin equipos: cada jugador es su propio equipo.
  const teams = b.teams
    ? b.teams.map((team) => team.map(toBattlePlayer))
    : (b.players ?? []).map((p) => [toBattlePlayer(p)]);
  const mapId = item.event.id || null;

  return {
    battleTime: parseSupercellDate(item.battleTime),
    mode: b.mode ?? item.event.mode ?? 'unknown',
    type: b.type ?? null,
    map: { id: mapId, name: item.event.map ?? null, imageUrl: mapImageUrl(mapId) },
    result: b.result ?? null,
    rank: b.rank ?? null,
    trophyChange: b.trophyChange ?? null,
    durationSeconds: b.duration ?? null,
    starPlayerTag: b.starPlayer?.tag ? stripHash(b.starPlayer.tag) : null,
    teams,
  };
}

export function toBattles(raw: RawBattleLog): Battle[] {
  return raw.items.map(toBattle);
}
```

`apps/api/src/mappers/club.ts`:
```ts
import type { Club } from '@brawlwiki/shared';
import { clubBadgeUrl, profileIconUrl } from '../assets/urls';
import type { RawClub } from '../supercell/types';
import { stripHash } from './common';

export function toClub(raw: RawClub): Club {
  return {
    tag: stripHash(raw.tag),
    name: raw.name,
    description: raw.description ?? '',
    type: raw.type,
    badgeId: raw.badgeId,
    badgeImageUrl: clubBadgeUrl(raw.badgeId),
    requiredTrophies: raw.requiredTrophies,
    trophies: raw.trophies,
    members: (raw.members ?? [])
      .map((m) => ({
        tag: stripHash(m.tag),
        name: m.name,
        nameColor: m.nameColor ?? null,
        role: m.role,
        trophies: m.trophies,
        icon: { id: m.icon.id, imageUrl: profileIconUrl(m.icon.id) },
      }))
      .sort((a, b) => b.trophies - a.trophies),
  };
}
```

`apps/api/src/mappers/rankings.ts`:
```ts
import type { ClubRanking, PlayerRanking } from '@brawlwiki/shared';
import { clubBadgeUrl, profileIconUrl } from '../assets/urls';
import type { RawClubRanking, RawList, RawPlayerRanking } from '../supercell/types';
import { stripHash } from './common';

export function toPlayerRankings(raw: RawList<RawPlayerRanking>): PlayerRanking[] {
  return raw.items.map((p) => ({
    rank: p.rank,
    tag: stripHash(p.tag),
    name: p.name,
    nameColor: p.nameColor ?? null,
    trophies: p.trophies,
    icon: { id: p.icon.id, imageUrl: profileIconUrl(p.icon.id) },
    clubName: p.club?.name ?? null,
  }));
}

export function toClubRankings(raw: RawList<RawClubRanking>): ClubRanking[] {
  return raw.items.map((c) => ({
    rank: c.rank,
    tag: stripHash(c.tag),
    name: c.name,
    trophies: c.trophies,
    badgeId: c.badgeId,
    badgeImageUrl: clubBadgeUrl(c.badgeId),
    memberCount: c.memberCount,
  }));
}
```

`apps/api/src/mappers/brawler.ts`:
```ts
import type { Brawler } from '@brawlwiki/shared';
import { type BrawlerMetaMap, getBrawlerMeta } from '../assets/brawler-meta';
import { brawlerImageUrl } from '../assets/urls';
import type { RawBrawler, RawList } from '../supercell/types';
import { named } from './common';

export function toBrawler(raw: RawBrawler, meta?: BrawlerMetaMap): Brawler {
  const m = getBrawlerMeta(raw.id, meta);
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: brawlerImageUrl(raw.id),
    rarity: m.rarity,
    class: m.class,
    gadgets: named(raw.gadgets),
    starPowers: named(raw.starPowers),
  };
}

export function toBrawlers(raw: RawList<RawBrawler>, meta?: BrawlerMetaMap): Brawler[] {
  return raw.items.map((b) => toBrawler(b, meta)).sort((a, b) => a.id - b.id);
}
```

`apps/api/src/mappers/event.ts`:
```ts
import { type EventSlot, parseSupercellDate } from '@brawlwiki/shared';
import { mapImageUrl } from '../assets/urls';
import type { RawEventSlot } from '../supercell/types';

export function toEventSlots(raw: RawEventSlot[]): EventSlot[] {
  return raw.map((s) => {
    const mapId = s.event.id || null;
    return {
      slotId: s.slotId,
      startTime: parseSupercellDate(s.startTime),
      endTime: parseSupercellDate(s.endTime),
      mode: { name: s.event.mode ?? 'unknown', imageUrl: null },
      map: { id: mapId, name: s.event.map ?? null, imageUrl: mapImageUrl(mapId) },
    };
  });
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- mappers && npm run typecheck -w @brawlwiki/api`
Expected: PASS (9 tests), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/mappers apps/api/test/mappers.test.ts
git commit -m "feat(api): mappers de Supercell a DTOs (jugador, battle log, club, rankings, brawlers, eventos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `api`: servicios y validación de parámetros

**Files:**
- Create: `apps/api/src/services.ts`, `apps/api/src/http/params.ts`
- Test: `apps/api/test/services.test.ts`, `apps/api/test/params.test.ts`

**Interfaces:**
- Consumes: `SupercellApi` (Task 5), `createFixtureClient` (Task 6, solo en tests), `CachedFetch` y `createCachedFetch` (Task 7), `createMemoryCache` y `POLICIES` (Task 4), mappers (Task 9), `BrawlerMetaMap` (Task 8), `AppError` e `isAppError` (Task 3), `parseTag` (Task 1), `DataResult` (Task 3).
- Produces:
  - `interface RequestContext { beforeUpstream?: () => void }`
  - `interface Services`, con estos métodos (el `ctx` opcional siempre es `RequestContext`):
    - `player(tag, ctx?)`
    - `battleLog(tag, ctx?)`
    - `club(tag, ctx?)`
    - `playerRankings(region, limit, ctx?)`
    - `clubRankings(region, limit, ctx?)`
    - `brawlerRankings(brawlerId, region, limit, ctx?)`
    - `brawlers(ctx?)`
    - `brawler(id, ctx?)`
    - `eventRotation(ctx?)`

    Todos devuelven `Promise<DataResult<DTO>>`.
  - `createServices(deps: { supercell: SupercellApi; cachedFetch: CachedFetch; brawlerMeta?: BrawlerMetaMap }): Services`
  - `RANKING_FETCH_LIMIT = 200`. A Supercell siempre se piden 200 y se recorta a `limit`, así una sola entrada de caché sirve para cualquier `limit`.
  - Claves de caché con prefijo de versión: `v1:player:{tag}`, `v1:battlelog:{tag}`, `v1:club:{tag}`, `v1:rank:players:{region}`, `v1:rank:clubs:{region}`, `v1:rank:brawler:{id}:{region}`, `v1:brawlers`, `v1:events`
  - `parseTagParam(value: unknown): string` (lanza `INVALID_TAG`)
  - `parseRegion(value: unknown): string`: `'global'` por defecto; un código de 2 letras sale en mayúsculas; si no, lanza `INVALID_PARAM`
  - `parseLimit(value: unknown): number`: 50 por defecto; entero de 1 a 200; si no, lanza `INVALID_PARAM`
  - `parseBrawlerId(value: unknown): number`: exactamente 8 dígitos; si no, lanza `INVALID_PARAM`

- [ ] **Step 1: Escribir los tests que fallan**

`apps/api/test/params.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseBrawlerId, parseLimit, parseRegion, parseTagParam } from '../src/http/params';

describe('params', () => {
  it('parseTagParam normaliza y valida', () => {
    expect(parseTagParam('#2pp')).toBe('2PP');
    expect(() => parseTagParam('hola')).toThrow(expect.objectContaining({ code: 'INVALID_TAG' }));
    expect(() => parseTagParam(undefined)).toThrow(expect.objectContaining({ code: 'INVALID_TAG' }));
  });

  it('parseRegion: global por defecto, país en mayúsculas, resto inválido', () => {
    expect(parseRegion(undefined)).toBe('global');
    expect(parseRegion('GLOBAL')).toBe('global');
    expect(parseRegion('mx')).toBe('MX');
    for (const bad of ['mexico', 'm', '12', ['MX']]) {
      expect(() => parseRegion(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });

  it('parseLimit: 50 por defecto, 1..200, resto inválido', () => {
    expect(parseLimit(undefined)).toBe(50);
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('200')).toBe(200);
    for (const bad of ['0', '201', '500', 'abc', '1.5', '-3', ['10']]) {
      expect(() => parseLimit(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });

  it('parseBrawlerId: exactamente 8 dígitos', () => {
    expect(parseBrawlerId('16000000')).toBe(16000000);
    for (const bad of ['1600', 'shelly', '160000001', undefined]) {
      expect(() => parseBrawlerId(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });
});
```

`apps/api/test/services.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { createServices, type Services } from '../src/services';
import { createFixtureClient } from '../src/supercell/fixtures';
import type { SupercellApi } from '../src/supercell/types';

let sc: SupercellApi;
let services: Services;

beforeEach(() => {
  sc = createFixtureClient({ slowMs: 5 });
  const { cachedFetch } = createCachedFetch({ cache: createMemoryCache() });
  services = createServices({ supercell: sc, cachedFetch, brawlerMeta: {} });
});

describe('services', () => {
  it('player: fresh y luego cache', async () => {
    expect((await services.player('2PP')).source).toBe('fresh');
    const again = await services.player('2PP');
    expect(again.source).toBe('cache');
    expect(again.data.tag).toBe('2PP');
  });

  it('player inexistente → NOT_FOUND con mensaje específico, también desde la caché negativa', async () => {
    const spy = vi.spyOn(sc, 'getPlayer');
    for (let i = 0; i < 2; i++) {
      await expect(services.player('999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'No existe un jugador con ese tag.',
      });
    }
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('club inexistente → mensaje de club', async () => {
    await expect(services.club('999')).rejects.toMatchObject({ message: 'No existe un club con ese tag.' });
  });

  it('rankings: una sola llamada upstream sirve para distintos limit', async () => {
    const spy = vi.spyOn(sc, 'getPlayerRankings');
    expect((await services.playerRankings('global', 2)).data).toHaveLength(2);
    const r = await services.playerRankings('global', 3);
    expect(r.data).toHaveLength(3);
    expect(r.source).toBe('cache');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('global', 200);
  });

  it('brawler por id sale del catálogo cacheado', async () => {
    const spy = vi.spyOn(sc, 'getBrawlers');
    expect((await services.brawler(16000002)).data.name).toBe('BULL');
    await expect(services.brawler(16000999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'No existe un brawler con ese id.',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('beforeUpstream se llama en un miss y no en un hit', async () => {
    const beforeUpstream = vi.fn();
    await services.eventRotation({ beforeUpstream });
    await services.eventRotation({ beforeUpstream });
    expect(beforeUpstream).toHaveBeenCalledTimes(1);
  });

  it('battleLog, clubRankings, brawlerRankings y brawlers devuelven DTOs', async () => {
    expect((await services.battleLog('2PP')).data).toHaveLength(4);
    expect((await services.clubRankings('global', 50)).data[0]!.tag).toBe('2YPLQ');
    expect((await services.brawlerRankings(16000000, 'global', 1)).data).toHaveLength(1);
    expect((await services.brawlers()).data).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/api -- services params`
Expected: FAIL, "Failed to resolve import ../src/services" y "../src/http/params".

- [ ] **Step 3: Implementar**

`apps/api/src/http/params.ts`:
```ts
import { parseTag } from '@brawlwiki/shared';
import { AppError } from '../errors';

export function parseTagParam(value: unknown): string {
  const tag = typeof value === 'string' ? parseTag(value) : null;
  if (!tag) throw new AppError('INVALID_TAG');
  return tag;
}

export function parseRegion(value: unknown): string {
  if (value === undefined) return 'global';
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'global') return 'global';
    if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
  }
  throw new AppError('INVALID_PARAM', 'Región inválida. Usa "global" o un código de país de 2 letras (ej. MX).');
}

export function parseLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n >= 1 && n <= 200) return n;
  }
  throw new AppError('INVALID_PARAM', 'limit debe ser un entero entre 1 y 200.');
}

export function parseBrawlerId(value: unknown): number {
  if (typeof value === 'string' && /^\d{8}$/.test(value)) return Number(value);
  throw new AppError('INVALID_PARAM', 'Id de brawler inválido.');
}
```

`apps/api/src/services.ts`:
```ts
import type { Battle, Brawler, Club, ClubRanking, EventSlot, Player, PlayerRanking } from '@brawlwiki/shared';
import type { BrawlerMetaMap } from './assets/brawler-meta';
import type { CachedFetch } from './cache/cached-fetch';
import { POLICIES } from './cache/policies';
import { AppError, isAppError } from './errors';
import { toBattles } from './mappers/battle';
import { toBrawlers } from './mappers/brawler';
import { toClub } from './mappers/club';
import { toEventSlots } from './mappers/event';
import { toPlayer } from './mappers/player';
import { toClubRankings, toPlayerRankings } from './mappers/rankings';
import type { SupercellApi } from './supercell/types';
import type { DataResult } from './types';

export interface RequestContext {
  beforeUpstream?: () => void;
}

export interface Services {
  player(tag: string, ctx?: RequestContext): Promise<DataResult<Player>>;
  battleLog(tag: string, ctx?: RequestContext): Promise<DataResult<Battle[]>>;
  club(tag: string, ctx?: RequestContext): Promise<DataResult<Club>>;
  playerRankings(region: string, limit: number, ctx?: RequestContext): Promise<DataResult<PlayerRanking[]>>;
  clubRankings(region: string, limit: number, ctx?: RequestContext): Promise<DataResult<ClubRanking[]>>;
  brawlerRankings(
    brawlerId: number,
    region: string,
    limit: number,
    ctx?: RequestContext,
  ): Promise<DataResult<PlayerRanking[]>>;
  brawlers(ctx?: RequestContext): Promise<DataResult<Brawler[]>>;
  brawler(id: number, ctx?: RequestContext): Promise<DataResult<Brawler>>;
  eventRotation(ctx?: RequestContext): Promise<DataResult<EventSlot[]>>;
}

export const RANKING_FETCH_LIMIT = 200;

/** Prefijo de versión: si cambia la forma de un DTO, se sube a v2 y la caché vieja se ignora. */
const key = (k: string) => `v1:${k}`;

async function notFoundAs<T>(message: string, p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isAppError(e) && e.code === 'NOT_FOUND') throw new AppError('NOT_FOUND', message);
    throw e;
  }
}

const sliced = <T>(r: DataResult<T[]>, limit: number): DataResult<T[]> => ({ ...r, data: r.data.slice(0, limit) });

export function createServices(deps: {
  supercell: SupercellApi;
  cachedFetch: CachedFetch;
  brawlerMeta?: BrawlerMetaMap;
}): Services {
  const { supercell: sc, cachedFetch, brawlerMeta } = deps;

  const brawlers: Services['brawlers'] = (ctx = {}) =>
    cachedFetch(key('brawlers'), POLICIES.brawlers, async () => toBrawlers(await sc.getBrawlers(), brawlerMeta), ctx);

  return {
    player: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un jugador con ese tag.',
        cachedFetch(key(`player:${tag}`), POLICIES.player, async () => toPlayer(await sc.getPlayer(tag), brawlerMeta), ctx),
      ),
    battleLog: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un jugador con ese tag.',
        cachedFetch(key(`battlelog:${tag}`), POLICIES.battlelog, async () => toBattles(await sc.getBattleLog(tag)), ctx),
      ),
    club: (tag, ctx = {}) =>
      notFoundAs(
        'No existe un club con ese tag.',
        cachedFetch(key(`club:${tag}`), POLICIES.club, async () => toClub(await sc.getClub(tag)), ctx),
      ),
    playerRankings: async (region, limit, ctx = {}) =>
      sliced(
        await cachedFetch(
          key(`rank:players:${region}`),
          POLICIES.rankings,
          async () => toPlayerRankings(await sc.getPlayerRankings(region, RANKING_FETCH_LIMIT)),
          ctx,
        ),
        limit,
      ),
    clubRankings: async (region, limit, ctx = {}) =>
      sliced(
        await cachedFetch(
          key(`rank:clubs:${region}`),
          POLICIES.rankings,
          async () => toClubRankings(await sc.getClubRankings(region, RANKING_FETCH_LIMIT)),
          ctx,
        ),
        limit,
      ),
    brawlerRankings: async (brawlerId, region, limit, ctx = {}) =>
      sliced(
        await notFoundAs(
          'No existe un brawler con ese id.',
          cachedFetch(
            key(`rank:brawler:${brawlerId}:${region}`),
            POLICIES.rankings,
            async () => toPlayerRankings(await sc.getBrawlerRankings(region, brawlerId, RANKING_FETCH_LIMIT)),
            ctx,
          ),
        ),
        limit,
      ),
    brawlers,
    brawler: async (id, ctx = {}) => {
      const list = await brawlers(ctx);
      const found = list.data.find((b) => b.id === id);
      if (!found) throw new AppError('NOT_FOUND', 'No existe un brawler con ese id.');
      return { ...list, data: found };
    },
    eventRotation: (ctx = {}) =>
      cachedFetch(key('events'), POLICIES.events, async () => toEventSlots(await sc.getEventRotation()), ctx),
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/api -- services params && npm run typecheck -w @brawlwiki/api`
Expected: PASS (11 tests), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services.ts apps/api/src/http/params.ts apps/api/test/services.test.ts apps/api/test/params.test.ts
git commit -m "feat(api): servicios con caché por recurso y validación de parámetros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `api`: rutas `/api/v1` y health real

**Files:**
- Create: `apps/api/src/routes/v1.ts`, `apps/api/src/health.ts`
- Modify: `apps/api/src/app.ts` (archivo completo abajo)
- Modify: `apps/api/test/helpers.ts` (se agrega `createTestApp`)
- Test: `apps/api/test/routes.test.ts`

**Interfaces:**
- Consumes: `Services`, `RequestContext` y `createServices` (Task 10), parsers de `http/params.ts` (Task 10), `sendData` (Task 3), `createCachedFetch` (Task 7), `createMemoryCache` y `Cache` (Task 4), `createFixtureClient` (Task 6), `createLogger` (Task 3).
- Produces:
  - `createV1Router(services: Services, contextFor?: (req: Request) => RequestContext): Router`
  - `createHealth(deps: { cache: Cache; supercell: SupercellApi; isCoolingDown(): Promise<boolean> }): () => Promise<Health>`
  - `AppDeps` pasa a ser `{ logger: Logger; health: () => Health | Promise<Health>; services?: Services; contextFor?: (req: Request) => RequestContext }`. Sin `services`, la app solo expone `/health`, así los tests de la Task 3 siguen valiendo.
  - `createTestApp(opts?: { supercell?: SupercellApi; now?: () => number; app?: Partial<AppDeps> }): { app: Express; cache: Cache; supercell: SupercellApi }` en `test/helpers.ts`

- [ ] **Step 1: Agregar `createTestApp` al helper**

Agregar al final de `apps/api/test/helpers.ts`:
```ts
import type { Express } from 'express';
import { type AppDeps, createApp } from '../src/app';
import type { Cache } from '../src/cache/cache';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { createHealth } from '../src/health';
import { createLogger } from '../src/logger';
import { createServices } from '../src/services';
import { createFixtureClient } from '../src/supercell/fixtures';
import type { SupercellApi } from '../src/supercell/types';

export function createTestApp(
  opts: { supercell?: SupercellApi; now?: () => number; app?: Partial<AppDeps> } = {},
): { app: Express; cache: Cache; supercell: SupercellApi } {
  const supercell = opts.supercell ?? createFixtureClient({ slowMs: 10 });
  const cache = createMemoryCache({ now: opts.now });
  const { cachedFetch, isCoolingDown } = createCachedFetch({ cache, now: opts.now });
  const services = createServices({ supercell, cachedFetch, brawlerMeta: {} });
  const app = createApp({
    logger: createLogger('silent'),
    health: createHealth({ cache, supercell, isCoolingDown }),
    services,
    ...opts.app,
  });
  return { app, cache, supercell };
}
```

Los `import` nuevos van arriba del archivo, junto a los existentes. ESM exige los imports en el nivel superior; en el archivo quedan todos al inicio.

- [ ] **Step 2: Escribir el test que falla**

`apps/api/test/routes.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors';
import { createFixtureClient } from '../src/supercell/fixtures';
import { createTestApp } from './helpers';

describe('/api/v1 jugadores y clubes', () => {
  it('GET /players/:tag → fresh (MISS) y luego cache (HIT)', async () => {
    const { app } = createTestApp();
    const first = await request(app).get('/api/v1/players/2PP');
    expect(first.status).toBe(200);
    expect(first.body.data.tag).toBe('2PP');
    expect(first.body.meta).toMatchObject({ source: 'fresh', ageSeconds: 0 });
    expect(first.headers['x-cache-status']).toBe('MISS');
    const second = await request(app).get('/api/v1/players/2PP');
    expect(second.headers['x-cache-status']).toBe('HIT');
    expect(second.body.meta.source).toBe('cache');
  });

  it('acepta %23 y minúsculas en el tag', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/players/%232pp');
    expect(res.status).toBe(200);
    expect(res.body.data.tag).toBe('2PP');
  });

  it('tag inválido → 400 INVALID_TAG sin llamar a Supercell', async () => {
    const supercell = createFixtureClient();
    const spy = vi.spyOn(supercell, 'getPlayer');
    const { app } = createTestApp({ supercell });
    const res = await request(app).get('/api/v1/players/hola');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TAG');
    expect(spy).not.toHaveBeenCalled();
  });

  it('jugador inexistente → 404 con mensaje', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/players/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('No existe un jugador con ese tag.');
  });

  it('mantenimiento sin dato → 503 UPSTREAM_MAINTENANCE', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/players/LLLL');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_MAINTENANCE');
  });

  it('Supercell cae después de cachear → 200 STALE con la edad real', async () => {
    let t = 1_000_000;
    const supercell = createFixtureClient();
    const { app } = createTestApp({ supercell, now: () => t });
    await request(app).get('/api/v1/players/2PP');
    vi.spyOn(supercell, 'getPlayer').mockRejectedValue(new AppError('UPSTREAM_UNAVAILABLE'));
    t += 121_000;
    const res = await request(app).get('/api/v1/players/2PP');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache-status']).toBe('STALE');
    expect(res.body.meta.source).toBe('stale');
    expect(res.body.meta.ageSeconds).toBeGreaterThanOrEqual(121);
  });

  it('battle log y club', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/players/2PP/battlelog')).body.data).toHaveLength(4);
    const club = await request(app).get('/api/v1/clubs/2YPLQ');
    expect(club.status).toBe(200);
    expect(club.body.data.members).toHaveLength(3);
  });
});

describe('/api/v1 rankings, brawlers y eventos', () => {
  it('rankings de jugadores con region en minúsculas y limit', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/rankings/players?region=mx&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it.each(['limit=500', 'limit=abc', 'limit=0', 'region=mexico', 'limit=10&limit=20'])(
    'query inválida (%s) → 400 INVALID_PARAM',
    async (qs) => {
      const { app } = createTestApp();
      const res = await request(app).get(`/api/v1/rankings/players?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAM');
    },
  );

  it('rankings de clubes y de brawler', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/rankings/clubs')).body.data).toHaveLength(2);
    expect((await request(app).get('/api/v1/rankings/brawlers/16000000')).body.data).toHaveLength(3);
    expect((await request(app).get('/api/v1/rankings/brawlers/shelly')).status).toBe(400);
  });

  it('catálogo de brawlers y detalle', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/brawlers')).body.data).toHaveLength(4);
    expect((await request(app).get('/api/v1/brawlers/16000002')).body.data.name).toBe('BULL');
    expect((await request(app).get('/api/v1/brawlers/16000999')).status).toBe(404);
    expect((await request(app).get('/api/v1/brawlers/xyz')).status).toBe(400);
  });

  it('rotación de eventos', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/events/rotation');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('health refleja caché y modo de Supercell', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.body.data).toEqual({ status: 'ok', cache: 'memory', supercell: 'mock' });
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- routes`
Expected: FAIL, "Failed to resolve import ../src/health".

- [ ] **Step 4: Implementar**

`apps/api/src/health.ts`:
```ts
import type { Health } from '@brawlwiki/shared';
import type { Cache } from './cache/cache';
import type { SupercellApi } from './supercell/types';

export function createHealth(deps: {
  cache: Cache;
  supercell: SupercellApi;
  isCoolingDown(): Promise<boolean>;
}): () => Promise<Health> {
  return async () => ({
    status: 'ok',
    cache: deps.cache.kind,
    supercell: deps.supercell.mode === 'mock' ? 'mock' : (await deps.isCoolingDown()) ? 'cooldown' : 'ok',
  });
}
```

`apps/api/src/routes/v1.ts`:
```ts
import { type Request, Router } from 'express';
import { parseBrawlerId, parseLimit, parseRegion, parseTagParam } from '../http/params';
import { sendData } from '../http/respond';
import type { RequestContext, Services } from '../services';

export function createV1Router(
  services: Services,
  contextFor: (req: Request) => RequestContext = () => ({}),
): Router {
  const r = Router();

  r.get('/players/:tag', async (req, res) => {
    sendData(res, await services.player(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/players/:tag/battlelog', async (req, res) => {
    sendData(res, await services.battleLog(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/clubs/:tag', async (req, res) => {
    sendData(res, await services.club(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/rankings/players', async (req, res) => {
    sendData(
      res,
      await services.playerRankings(parseRegion(req.query.region), parseLimit(req.query.limit), contextFor(req)),
    );
  });
  r.get('/rankings/clubs', async (req, res) => {
    sendData(
      res,
      await services.clubRankings(parseRegion(req.query.region), parseLimit(req.query.limit), contextFor(req)),
    );
  });
  r.get('/rankings/brawlers/:brawlerId', async (req, res) => {
    sendData(
      res,
      await services.brawlerRankings(
        parseBrawlerId(req.params.brawlerId),
        parseRegion(req.query.region),
        parseLimit(req.query.limit),
        contextFor(req),
      ),
    );
  });
  r.get('/brawlers', async (req, res) => {
    sendData(res, await services.brawlers(contextFor(req)));
  });
  r.get('/brawlers/:id', async (req, res) => {
    sendData(res, await services.brawler(parseBrawlerId(req.params.id), contextFor(req)));
  });
  r.get('/events/rotation', async (req, res) => {
    sendData(res, await services.eventRotation(contextFor(req)));
  });

  return r;
}
```

`apps/api/src/app.ts` (archivo completo):
```ts
import type { Health } from '@brawlwiki/shared';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';
import { createV1Router } from './routes/v1';
import type { RequestContext, Services } from './services';

export interface AppDeps {
  logger: Logger;
  health: () => Health | Promise<Health>;
  services?: Services;
  contextFor?: (req: Request) => RequestContext;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());

  app.get('/api/v1/health', async (_req, res) => {
    sendData(res, { data: await deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });
  if (deps.services) app.use('/api/v1', createV1Router(deps.services, deps.contextFor));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
```

- [ ] **Step 5: Correr toda la suite de `api` y verificar que pasa**

Run: `npm test -w @brawlwiki/api && npm run typecheck -w @brawlwiki/api`
Expected: PASS en todos los archivos. `routes.test.ts` aporta 16 tests, porque `it.each` genera 5. Typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes apps/api/src/health.ts apps/api/src/app.ts apps/api/test/helpers.ts apps/api/test/routes.test.ts
git commit -m "feat(api): rutas /api/v1 (jugadores, clubes, rankings, brawlers, eventos) y health real

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `api`: rate limiting (general por IP y guardia de llamadas upstream)

**Files:**
- Create: `apps/api/src/http/rate-limit.ts`
- Modify: `apps/api/src/app.ts` (archivo completo abajo)
- Test: `apps/api/test/rate-limit.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 3), `RequestContext` (Task 10), `createTestApp` (Task 11).
- Produces:
  - `createGeneralLimiter(opts: { perMinute: number; store?: Store }): RequestHandler`. No limita `/api/v1/health`. Al exceder el límite lanza `AppError('RATE_LIMITED', …, { retryAfter })`.
  - `interface UpstreamGuard { check(key: string): void }`. Lanza `RATE_LIMITED` si esa IP superó `perMinute` llamadas upstream en los últimos 60s.
  - `createUpstreamGuard(opts: { perMinute: number; now?: () => number }): UpstreamGuard`
  - `AppDeps` suma `rateLimit?: { generalPerMinute: number; upstreamPerMinute: number; store?: Store }`. Si está presente, `createApp` monta el limitador general y arma `contextFor` con la guardia (salvo que se pase un `contextFor` explícito).

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/rate-limit.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createUpstreamGuard } from '../src/http/rate-limit';
import { createTestApp } from './helpers';

describe('createUpstreamGuard', () => {
  it('permite perMinute llamadas por clave en 60s y luego lanza RATE_LIMITED con retryAfter', () => {
    let t = 0;
    const g = createUpstreamGuard({ perMinute: 3, now: () => t });
    g.check('a');
    t = 10_000;
    g.check('a');
    g.check('a');
    expect(() => g.check('a')).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfter: 50 }));
    expect(() => g.check('b')).not.toThrow();
    t = 60_000;
    expect(() => g.check('a')).not.toThrow();
  });
});

const IP_A = '203.0.113.5';
const IP_B = '198.51.100.7';

describe('limitador general', () => {
  it('429 al superar el límite por IP; otra IP y /health no se ven afectadas', async () => {
    const { app } = createTestApp({ app: { rateLimit: { generalPerMinute: 3, upstreamPerMinute: 100 } } });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_A)).status).toBe(200);
    }
    const blocked = await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_A);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error.requestId).toBe(blocked.headers['x-request-id']);

    expect((await request(app).get('/api/v1/events/rotation').set('X-Forwarded-For', IP_B)).status).toBe(200);
    expect((await request(app).get('/api/v1/health').set('X-Forwarded-For', IP_A)).status).toBe(200);
  });
});

describe('guardia upstream por IP', () => {
  it('solo cuentan las consultas que llegan a Supercell', async () => {
    const { app } = createTestApp({ app: { rateLimit: { generalPerMinute: 100, upstreamPerMinute: 2 } } });
    const get = (path: string, ip = IP_A) => request(app).get(path).set('X-Forwarded-For', ip);

    expect((await get('/api/v1/players/2PP')).status).toBe(200); // upstream 1
    expect((await get('/api/v1/players/2PP')).headers['x-cache-status']).toBe('HIT'); // no cuenta
    expect((await get('/api/v1/clubs/2YPLQ')).status).toBe(200); // upstream 2
    const blocked = await get('/api/v1/clubs/8CGRV');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await get('/api/v1/clubs/8CGRV', IP_B)).status).toBe(200);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/api -- rate-limit`
Expected: FAIL, "Failed to resolve import ../src/http/rate-limit".

- [ ] **Step 3: Implementar**

`apps/api/src/http/rate-limit.ts`:
```ts
import type { Request, RequestHandler } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import { AppError } from '../errors';

const WINDOW_MS = 60_000;

export function createGeneralLimiter(opts: { perMinute: number; store?: Store }): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: opts.perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(opts.store ? { store: opts.store } : {}),
    skip: (req) => req.path === '/api/v1/health',
    handler: (req, _res, next) => {
      const reset = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : 60;
      next(new AppError('RATE_LIMITED', undefined, { retryAfter }));
    },
  });
}

export interface UpstreamGuard {
  check(key: string): void;
}

/** Ventana deslizante en memoria: cuántas consultas a Supercell provoca cada IP por minuto. */
export function createUpstreamGuard(opts: { perMinute: number; now?: () => number }): UpstreamGuard {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function prune(t: number) {
    if (hits.size < 10_000) return;
    for (const [k, list] of hits) {
      if (list.every((x) => t - x >= WINDOW_MS)) hits.delete(k);
    }
  }

  return {
    check(key) {
      const t = now();
      prune(t);
      const recent = (hits.get(key) ?? []).filter((x) => t - x < WINDOW_MS);
      if (recent.length >= opts.perMinute) {
        hits.set(key, recent);
        const retryAfter = Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - t) / 1000));
        throw new AppError('RATE_LIMITED', 'Estás buscando demasiados perfiles nuevos. Espera un momento.', {
          retryAfter,
        });
      }
      recent.push(t);
      hits.set(key, recent);
    },
  };
}
```

`apps/api/src/app.ts` (archivo completo):
```ts
import type { Health } from '@brawlwiki/shared';
import express, { type Express, type Request } from 'express';
import type { Store } from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { createGeneralLimiter, createUpstreamGuard } from './http/rate-limit';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';
import { createV1Router } from './routes/v1';
import type { RequestContext, Services } from './services';

export interface AppDeps {
  logger: Logger;
  health: () => Health | Promise<Health>;
  services?: Services;
  contextFor?: (req: Request) => RequestContext;
  rateLimit?: { generalPerMinute: number; upstreamPerMinute: number; store?: Store };
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // Next.js (en 127.0.0.1) reenvía la IP real del usuario en X-Forwarded-For.
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());

  let contextFor = deps.contextFor;
  if (deps.rateLimit) {
    app.use(createGeneralLimiter({ perMinute: deps.rateLimit.generalPerMinute, store: deps.rateLimit.store }));
    const guard = createUpstreamGuard({ perMinute: deps.rateLimit.upstreamPerMinute });
    contextFor ??= (req) => ({ beforeUpstream: () => guard.check(req.ip ?? 'unknown') });
  }

  app.get('/api/v1/health', async (_req, res) => {
    sendData(res, { data: await deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });
  if (deps.services) app.use('/api/v1', createV1Router(deps.services, contextFor));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
```

- [ ] **Step 4: Correr toda la suite de `api` y verificar que pasa**

Run: `npm test -w @brawlwiki/api && npm run typecheck -w @brawlwiki/api`
Expected: PASS en todos los archivos (`rate-limit.test.ts` aporta 3 tests), typecheck limpio. Si express-rate-limit imprime un warning de validación `ERR_ERL_*` en consola, leer el código que indica. Con `trust proxy = 'loopback'` no debería aparecer ninguno.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/http/rate-limit.ts apps/api/src/app.ts apps/api/test/rate-limit.test.ts
git commit -m "feat(api): rate limit general por IP y guardia de consultas a Supercell por IP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `api`: logs HTTP, OpenAPI, arranque real y documentación

**Files:**
- Create: `apps/api/src/openapi.ts`, `apps/api/src/index.ts`, `apps/api/.env.example`, `README.md`
- Modify: `apps/api/src/app.ts` (archivo completo abajo)
- Test: `apps/api/test/openapi.test.ts`, `apps/api/test/security.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `buildOpenApiDocument(): OpenAPIObject` (OpenAPI 3.1, `servers: [{ url: '/api/v1' }]`)
  - `GET /api/v1/openapi.json`
  - Log por request con pino-http, usando `id` = `X-Request-Id`
  - `src/index.ts`: proceso real. Carga `.env` con `process.loadEnvFile()`, elige Redis o memoria y cliente real o fixtures, y aplica rate limit 60/20.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/api/test/openapi.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../src/openapi';
import { createTestApp } from './helpers';

describe('OpenAPI', () => {
  it('documenta todas las rutas de v1', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
      [
        '/brawlers',
        '/brawlers/{id}',
        '/clubs/{tag}',
        '/events/rotation',
        '/health',
        '/players/{tag}',
        '/players/{tag}/battlelog',
        '/rankings/brawlers/{brawlerId}',
        '/rankings/clubs',
        '/rankings/players',
      ].sort(),
    );
    expect(doc.info.description).toContain('no oficial');
  });

  it('se sirve en /api/v1/openapi.json', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });
});
```

`apps/api/test/security.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger';
import { createSupercellClient } from '../src/supercell/client';
import { createTestApp, fakeFetch } from './helpers';

const KEY = 'eyJ0eXAi.clave-super-secreta.123';

describe('la API key nunca se filtra', () => {
  it('ni en la respuesta ni en los logs cuando Supercell rechaza la key (403)', async () => {
    const lines: string[] = [];
    const logger = createLogger('trace', { write: (s: string) => void lines.push(s) });
    const f = fakeFetch([{ status: 403, body: { reason: 'accessDenied.invalidIp', message: 'Invalid authorization' } }]);
    const supercell = createSupercellClient({ apiKey: KEY, baseUrl: 'https://api.test/v1', fetchImpl: f.impl, logger });
    const { app } = createTestApp({ supercell, app: { logger } });

    const res = await request(app).get('/api/v1/players/2PP');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain(KEY);
    expect(JSON.stringify(res.headers)).not.toContain(KEY);
    const logs = lines.join('\n');
    expect(logs).toContain('IP no autorizada');
    expect(logs).not.toContain(KEY);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/api -- openapi security`
Expected: FAIL. `openapi.test.ts` no resuelve `../src/openapi`. `security.test.ts` puede pasar ya (la redacción viene de la Task 3): si pasa, está bien, porque ese test fija el comportamiento y no depende de código nuevo.

- [ ] **Step 3: Implementar OpenAPI y logs HTTP**

`apps/api/src/openapi.ts`:
```ts
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import {
  ApiErrorBodySchema,
  BattleSchema,
  BrawlerSchema,
  ClubRankingSchema,
  ClubSchema,
  envelopeSchema,
  EventSlotSchema,
  HealthSchema,
  PlayerRankingSchema,
  PlayerSchema,
} from '@brawlwiki/shared';
import { z } from 'zod';

extendZodWithOpenApi(z);

let cached: ReturnType<OpenApiGeneratorV31['generateDocument']> | undefined;

export function buildOpenApiDocument() {
  if (cached) return cached;
  const registry = new OpenAPIRegistry();

  const tag = z.object({ tag: z.string().describe('Tag sin #, ej. 2PP') });
  const rankingQuery = z.object({
    region: z.string().optional().describe('"global" (defecto) o código de país de 2 letras'),
    limit: z.string().optional().describe('1..200, defecto 50'),
  });

  const get = (
    path: string,
    summary: string,
    data: z.ZodType,
    request?: { params?: z.ZodObject; query?: z.ZodObject },
  ) =>
    registry.registerPath({
      method: 'get',
      path,
      summary,
      ...(request ? { request } : {}),
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: envelopeSchema(data) } } },
        default: { description: 'Error', content: { 'application/json': { schema: ApiErrorBodySchema } } },
      },
    });

  get('/players/{tag}', 'Perfil de jugador', PlayerSchema, { params: tag });
  get('/players/{tag}/battlelog', 'Últimas ~25 partidas', z.array(BattleSchema), { params: tag });
  get('/clubs/{tag}', 'Club con miembros', ClubSchema, { params: tag });
  get('/rankings/players', 'Ranking de jugadores', z.array(PlayerRankingSchema), { query: rankingQuery });
  get('/rankings/clubs', 'Ranking de clubes', z.array(ClubRankingSchema), { query: rankingQuery });
  get('/rankings/brawlers/{brawlerId}', 'Ranking por brawler', z.array(PlayerRankingSchema), {
    params: z.object({ brawlerId: z.string() }),
    query: rankingQuery,
  });
  get('/brawlers', 'Catálogo de brawlers', z.array(BrawlerSchema));
  get('/brawlers/{id}', 'Detalle de brawler', BrawlerSchema, { params: z.object({ id: z.string() }) });
  get('/events/rotation', 'Rotación actual de eventos', z.array(EventSlotSchema));
  get('/health', 'Estado del servicio', HealthSchema);

  cached = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'BrawlWiki API',
      version: '1.0.0',
      description: 'API interna de BrawlWiki. Este material es no oficial y no está avalado por Supercell.',
    },
    servers: [{ url: '/api/v1' }],
  });
  return cached;
}
```

`apps/api/src/app.ts` (archivo completo):
```ts
import type { Health } from '@brawlwiki/shared';
import express, { type Express, type Request } from 'express';
import type { Store } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { createGeneralLimiter, createUpstreamGuard } from './http/rate-limit';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import type { Logger } from './logger';
import { buildOpenApiDocument } from './openapi';
import { createV1Router } from './routes/v1';
import type { RequestContext, Services } from './services';

export interface AppDeps {
  logger: Logger;
  health: () => Health | Promise<Health>;
  services?: Services;
  contextFor?: (req: Request) => RequestContext;
  rateLimit?: { generalPerMinute: number; upstreamPerMinute: number; store?: Store };
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // Next.js (en 127.0.0.1) reenvía la IP real del usuario en X-Forwarded-For.
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(requestId());
  app.use(pinoHttp({ logger: deps.logger, genReqId: (_req, res) => String(res.getHeader('X-Request-Id')) }));

  let contextFor = deps.contextFor;
  if (deps.rateLimit) {
    app.use(createGeneralLimiter({ perMinute: deps.rateLimit.generalPerMinute, store: deps.rateLimit.store }));
    const guard = createUpstreamGuard({ perMinute: deps.rateLimit.upstreamPerMinute });
    contextFor ??= (req) => ({ beforeUpstream: () => guard.check(req.ip ?? 'unknown') });
  }

  app.get('/api/v1/health', async (_req, res) => {
    sendData(res, { data: await deps.health(), source: 'fresh', fetchedAt: Date.now() });
  });
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(buildOpenApiDocument());
  });
  if (deps.services) app.use('/api/v1', createV1Router(deps.services, contextFor));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));
  return app;
}
```

- [ ] **Step 4: Correr toda la suite y verificar que pasa**

Run: `npm test && npm run typecheck`
Expected: PASS en `shared` y `api`, typecheck limpio en ambos. Si el typecheck marca `import { pinoHttp } from 'pino-http'`, usar el export por defecto (`import pinoHttp from 'pino-http'`), que existe en todas las versiones. Si `registerPath` rechaza `z.ZodObject` sin genéricos en `request`, tipar el parámetro como `z.ZodObject<z.ZodRawShape>`.

- [ ] **Step 5: Crear el arranque real, `.env.example` y README**

`apps/api/src/index.ts`:
```ts
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { createApp } from './app';
import { createCachedFetch } from './cache/cached-fetch';
import { createMemoryCache } from './cache/memory';
import { createRedisCache } from './cache/redis';
import { loadConfig } from './config';
import { createHealth } from './health';
import { createLogger } from './logger';
import { createServices } from './services';
import { createSupercellClient } from './supercell/client';
import { createFixtureClient } from './supercell/fixtures';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const config = loadConfig();
const logger = createLogger(config.logLevel);
const redis = config.redisUrl ? createRedisCache(config.redisUrl) : null;
const cache = redis ?? createMemoryCache();
const supercell = config.supercellMock
  ? createFixtureClient()
  : createSupercellClient({ apiKey: config.supercellApiKey!, baseUrl: config.supercellApiBase, logger });
const { cachedFetch, isCoolingDown } = createCachedFetch({ cache, logger });

const app = createApp({
  logger,
  services: createServices({ supercell, cachedFetch }),
  health: createHealth({ cache, supercell, isCoolingDown }),
  rateLimit: {
    generalPerMinute: 60,
    upstreamPerMinute: 20,
    ...(redis
      ? {
          store: new RedisStore({
            prefix: 'rl:',
            sendCommand: (command: string, ...args: string[]) =>
              redis.client.call(command, ...args) as Promise<RedisReply>,
          }),
        }
      : {}),
  },
});

const server = app.listen(config.port, config.host, () => {
  logger.info(
    { url: `http://${config.host}:${config.port}/api/v1`, cache: cache.kind, supercell: supercell.mode },
    'BrawlWiki API lista',
  );
});

function shutdown() {
  server.close(() => {
    void redis?.quit();
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

`apps/api/.env.example`:
```
# Key de https://developer.brawlstars.com (atada a tu IP pública)
SUPERCELL_API_KEY=
# 1 = usar fixtures locales en vez de la API real (tests, sin key o si cambió tu IP)
SUPERCELL_MOCK=0
SUPERCELL_API_BASE=https://api.brawlstars.com/v1
HOST=127.0.0.1
PORT=4000
# Vacío = caché en memoria. Ej: redis://127.0.0.1:6379
REDIS_URL=
LOG_LEVEL=info
```

`README.md`:
````markdown
# BrawlWiki

Fan page no oficial de Brawl Stars. **Este material es no oficial y no está avalado por Supercell.**

## Requisitos

- Node 24+
- Una API key de https://developer.brawlstars.com registrada con tu IP pública (opcional si usas el modo fixtures)

## Arranque

```bash
npm install
cp apps/api/.env.example apps/api/.env   # y pega tu key en SUPERCELL_API_KEY
npm run dev                              # API en http://127.0.0.1:4000/api/v1
```

Sin key, o si cambió tu IP: pon `SUPERCELL_MOCK=1` en `apps/api/.env`.

| Tag de fixtures | Qué simula |
|---|---|
| `2PP` | Jugador con club (`2YPLQ`) |
| `8QU` | Jugador sin club |
| `RRRR` | Supercell responde 429 |
| `LLLL` | Mantenimiento |
| `GGGG` | Respuesta lenta (4 s) |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de todos los paquetes |
| `npm run typecheck` | Chequeo de tipos |
| `npm run meta:import -w @brawlwiki/api -- <ruta absoluta a brawlers.json>` | Actualiza rareza y clase de los brawlers. El JSON se descarga desde el navegador en https://api.brawlify.com/v1/brawlers |

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`.
````

- [ ] **Step 6: Smoke test del proceso real en modo fixtures**

Run:
```bash
(cd apps/api && SUPERCELL_MOCK=1 LOG_LEVEL=warn node --import tsx src/index.ts) &
sleep 4
curl -s http://127.0.0.1:4000/api/v1/health; echo
curl -s -o /dev/null -w "%{http_code} %header{x-cache-status}\n" http://127.0.0.1:4000/api/v1/players/2PP
curl -s -o /dev/null -w "%{http_code} %header{x-cache-status}\n" http://127.0.0.1:4000/api/v1/players/2PP
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/v1/players/hola
curl -s http://127.0.0.1:4000/api/v1/openapi.json | head -c 80; echo
kill %1
```
Expected:
```
{"data":{"status":"ok","cache":"memory","supercell":"mock"},"meta":{...}}
200 MISS
200 HIT
400
{"openapi":"3.1.0","info":{"title":"BrawlWiki API",...
```

- [ ] **Step 7: Smoke test con la key real (manual, requiere tu key y tu IP registrada)**

Run (con `SUPERCELL_API_KEY` en `apps/api/.env` y `SUPERCELL_MOCK=0`):
```bash
npm run dev &
sleep 5
curl -s "http://127.0.0.1:4000/api/v1/players/<TU_TAG_SIN_#>" | head -c 300; echo
curl -s "http://127.0.0.1:4000/api/v1/events/rotation" | head -c 300; echo
kill %1
```
Expected: JSON con tu perfil y la rotación actual. Si responde `503 UPSTREAM_UNAVAILABLE` y el log dice "¿key inválida o IP no autorizada?", la IP registrada en la key no coincide con tu IP pública actual.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/openapi.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/.env.example apps/api/test/openapi.test.ts apps/api/test/security.test.ts README.md
git commit -m "feat(api): logs HTTP, OpenAPI en /api/v1/openapi.json, arranque real y README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cobertura de la spec (Plan 1)

| Spec | Task |
|---|---|
| §2 Monorepo, `shared` como fuente de verdad | 1, 2 |
| §3 Cliente de Supercell (timeout, reintento, concurrencia, errores, 403) | 5 |
| §3 Tags | 1, 10 |
| §3 Caché de dos tiempos, dedupe, 404 negativo, cooldown | 4, 7 |
| §3 Assets (CDN y rareza local) | 8 |
| §3 Rate limiting (general + upstream por IP, `trust proxy`, Redis store) | 12, 13 |
| §3 Seguridad (key, redacción, helmet, sin CORS, sin stacks) | 3, 5, 13 |
| §3 Modo fixtures | 6 |
| §4 Contrato (endpoints, envoltorios, headers, códigos, DTOs, OpenAPI) | 2, 3, 9, 10, 11, 13 |
| §8 Testing de `shared` y `api` | todas |
| §9 Variables de entorno, desarrollo local | 3, 13 |
| §5-7 Frontend, design system, errores de UX, E2E, Lighthouse | **Plan 2** |
| §9 Deploy PM2 + Nginx | Fuera de la v1 (documentado en la spec) |
