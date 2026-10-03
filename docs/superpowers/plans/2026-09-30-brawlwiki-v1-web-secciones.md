# BrawlWiki v1 — Plan 3: `web` (clubes, comparador, rankings, brawlers y cierre de la v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el frontend v1 de BrawlWiki: página de club con imagen OG, comparador de clubes, rankings (jugadores, clubes y por brawler, con región), catálogo y detalle de brawlers y página "Acerca de". Además, E2E de todo lo nuevo, medición con Lighthouse y los pendientes que quedaron del Plan 2.

**Architecture:** Mismos patrones del Plan 2.
- **Datos:** Server Components piden los datos con las queries de `src/lib/queries.ts`, envueltas en `cache()`.
- **Errores:** se muestran en línea con `attempt()` + `ApiErrorView`, y `NOT_FOUND` llama a `notFound()`.
- **Estado en la URL:** se guarda todo ahí. Los filtros (región, brawler, rareza, clase, búsqueda) y el comparador usan **formularios nativos `method="get"`**, que funcionan sin JavaScript y antes de hidratar. Los tipos de ranking son `Tabs` con links.
- **Componentes de cliente:** no se agregan nuevos; los interactivos (`TagSearch`, `FavoriteButton`, `RecordVisit`, `GameImage`, `AnimatedNumber`) ya existen.

**Tech Stack:** Next.js 16.3.7, React 19.3, Tailwind CSS 4.3, Zod 4 (vía `@brawlwiki/shared`), Vitest 5 + Testing Library + jsdom, Playwright 1.63 + @axe-core/playwright y Lighthouse 13 (vía `npx`, solo para medir). No se agregan dependencias al proyecto.

**Spec:** `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`, secciones 4 a 8. El Plan 2 (`docs/superpowers/plans/2026-09-30-brawlwiki-v1-web-core.md`) ya está mergeado en `main`. Este plan parte de ese código.

**Documentación de Next 16:** está en `node_modules/next/dist/docs/`. Ante cualquier duda de API, leer ahí antes de suponer.

## Global Constraints

- **Versiones:** `next@16.3.7`, `react@19.3.0`, `tailwindcss@^4.3.3`, TypeScript `~5.9.3`, Node 24. **No se agregan dependencias.**
- **Rutas y texto:** todas las rutas y todo el texto de la interfaz van en **español**.
- **Next 16:**
  - `params` y `searchParams` son **asíncronos** (siempre con `await`). Las páginas usan el tipo global `PageProps<'/ruta'>`.
  - Las imágenes OG reciben `params` como `Promise` y exportan `alt`, `size` (literal `{ width: 1200, height: 630 }`) y `contentType`.
- **Acceso a datos:**
  - El navegador **nunca** llama a Express; solo lo hace `src/lib/queries.ts`.
  - Toda query nueva:
    - va envuelta en `cache()` de React;
    - reenvía `forwardedFor()`;
    - valida la respuesta con el esquema de `@brawlwiki/shared`.
- **Errores de la API:**
  - Se muestran en línea con `ApiErrorView`: `UPSTREAM_MAINTENANCE` va a `MaintenanceNotice` y el resto a `ErrorState`.
  - `NOT_FOUND` de un recurso de la URL llama a `notFound()`. **Nunca se lanzan** a `error.tsx`.
  - `redirect()` y `notFound()` van **fuera** de `attempt()`.
- **Componentes de cliente:** importan la validación de tags desde `@brawlwiki/shared/tags`, no desde `@brawlwiki/shared`.
- **Formularios de filtros y comparador:** son `<form method="get" action="/ruta">` nativos en Server Components, con `defaultValue`, sin estado de cliente. Cada control tiene un `<label>` visible y mide al menos 44px (`min-h-11`).
- **Tokens:** los de `src/app/globals.css` (dark en `:root`, light en `[data-theme="light"]`).
  - El anillo de foco usa `var(--primary)`.
  - `Chip` usa fondos opacos (`color-mix` con `--surface`).
  - No se agregan colores sueltos, salvo los del podio de `RankBadge` (Task 5) y el `#0b0b0f` de la base de las cartas, que ya existe.
- **Tipografía:** Lilita One (`font-display`) solo en títulos y números grandes; Inter en todo lo demás. Todos los números llevan `tabular-nums` y se formatean con `formatNumber` (`Intl.NumberFormat('es-MX')`).
- **Accesibilidad:**
  - áreas táctiles de al menos 44px;
  - nada se comunica solo con color: el resultado, el podio, la rareza y el "mayor" del comparador también van en texto;
  - los links dentro de bloques de texto o de filas van **subrayados siempre** (`underline underline-offset-2`), porque axe marca `link-in-text-block`;
  - cero violaciones *serious* o *critical* de axe (WCAG 2.0/2.1 A y AA) en cada página nueva, en tema oscuro y claro.
- **Metadatos de brawlers:** hoy `apps/api/src/assets/brawler-meta.json` es `{}`, así que **todos los brawlers llegan con `rarity: null` y `class: null`**. La interfaz tiene que funcionar así:
  - los selects de rareza y clase se ocultan si no hay valores;
  - las cartas usan el color neutro;
  - el detalle dice "Sin dato".

  Los datos aparecen solos cuando el usuario corre `npm run meta:import -w @brawlwiki/api`.
- **Nombres:** Supercell manda los nombres de brawlers, gadgets y habilidades estelares en MAYÚSCULAS. Se muestran con `displayName()`.
- **Disclaimer:** el texto exacto **"Este material es no oficial y no está avalado por Supercell."** va en el `Footer`, en la imagen OG y en `/acerca`.
- **`localStorage`:** usa `bw:recent` (máximo 10) y `bw:favorites`, con entradas `{ type: 'player' | 'club', tag, name? }`.
- **E2E:**
  - los specs nuevos van en el proyecto `main` de Playwright;
  - cualquier spec que use `RRRR` va en `cooldown`;
  - cada test usa el `test` de `e2e/fixtures.ts` (IP propia por test).
- **Commits:** mensajes estilo conventional (`feat(web): …`), terminados en la línea `Co-Authored-By` del modelo que escribió el código. Los comandos se ejecutan desde la raíz del repo en **Git Bash**. El puerto 3000 lo usa otro proceso del usuario: **nunca** hay que matarlo. Los E2E usan 3100 (web) y 4100 (API).

**Datos de los fixtures de la API** (modo `SUPERCELL_MOCK=1`, lo que ven los E2E):

| Recurso | Datos |
|---|---|
| Club `2YPLQ` | "Los Cracks", `inviteOnly`, 1,020,000 trofeos, 25,000 requeridos, descripción "Club de prueba. ¡Activos diario!". Miembros: EzyPlayer (`2PP`, president, 42,310), Mika (`Y2YY`, vicePresident, 40,100), SinClub (`8QU`, member, 1,200) |
| Club `8CGRV` | "Titanes", `open`, 940,000 trofeos, 30,000 requeridos, sin descripción. Miembros: Rival2 (`QQQ`, president, 45,000), Rival1 (`PPP`, member, 38,000) |
| Ranking de jugadores (cualquier región y también por brawler) | 1. xXProXx (`YYYY`, 98,410, club "Tribe"); 2. Rival2 (`QQQ`, 97,022, "Titanes"); 3. SoloPro (`LLLQ`, 96,870, sin club) |
| Ranking de clubes (cualquier región) | 1. Los Cracks (`2YPLQ`, 1,020,000, 30 miembros); 2. Titanes (`8CGRV`, 940,000, 27 miembros) |
| Brawlers | Shelly 16000000 (gadget "FAST FORWARD", habilidad estelar "SHELL SHOCK"), Colt 16000001 (sin ninguno), Bull 16000002 (gadget "T-BONE INJECTOR"), Brock 16000003 (sin ninguno). Todos con `rarity: null` y `class: null`. Un id de 8 dígitos que no existe da `NOT_FOUND` |
| Tags de escenario | `LLLL` mantenimiento, `GGGG` lento (4 s), `RRRR` 429 con cooldown global. También aplican a `/clubs/:tag` |

Los rankings de los fixtures **no cambian según la región**. El caso "región sin datos" (Supercell responde `200` con `[]` para `ZZ`) se prueba con tests unitarios en la Task 6.

## Review Focus

1. **Sin metadatos de brawlers** (el caso real hoy): el catálogo no muestra los selects de rareza y clase, muestra la nota "La rareza y la clase todavía no están disponibles." y el detalle dice "Sin dato" sin romperse. Tests en la Task 7 (`brawlerFacets` vacío y formulario sin selects) y en la Task 9 ("Sin dato").
2. **Región sin datos** (`/rankings?region=ZZ`, que Supercell responde con `200` y `[]`): se espera `EmptyState` "No hay ranking para esta región", y el select muestra la región elegida aunque no esté en la lista. Tests en la Task 5 (`regionOptions('ZZ')`) y en la Task 6 (`RankingSection` con `[]`).
3. **Comparador con datos sucios:** el mismo club dos veces, un tag inválido o un club que no existe dan un error en línea en el campo o en el lado que corresponde, nunca una página 404 completa. Tests en la Task 4 (`parseCompareParams`) y E2E en la Task 11.
4. **Club vacío o raro:** sin miembros, el promedio es 0 (no `NaN`) y se muestra el estado vacío; sin descripción, no aparece un párrafo vacío; con una descripción larga sin espacios, no hay scroll horizontal a 375px. Tests en la Task 2 y E2E a 375px en la Task 11.
5. **Búsqueda de brawlers con acentos o mayúsculas** ("Shélly", "el primo", "8-bit"): se espera que encuentre el brawler. Test en la Task 7 (`filterBrawlers` con texto normalizado).

---

## Estructura de archivos

```
apps/web/src/
├── app/
│   ├── club/[tag]/            page.tsx · loading.tsx · not-found.tsx · opengraph-image.tsx
│   ├── clubes/comparar/       page.tsx
│   ├── rankings/              page.tsx · loading.tsx
│   ├── brawlers/              page.tsx · loading.tsx
│   ├── brawlers/[id]/         page.tsx · loading.tsx · not-found.tsx
│   └── acerca/                page.tsx
├── assets/fonts/              + Geist-Regular.ttf, Geist-OFL.txt (cuerpo de las imágenes OG)
├── lib/
│   ├── route-params.ts        resolveTag (movido desde player-route), parseBrawlerIdParam
│   ├── og.tsx                 OgFrame, OgFallback, ogFonts, OG_COLORS, OG_DISPLAY, OG_BOX
│   ├── clubs.ts               roleLabel, clubTypeLabel, summarizeClub, compareClubs, parseCompareParams
│   ├── rankings.ts            tipos de ranking, regiones, links, subtítulo, RANKING_LIMIT
│   ├── catalog.ts             rarityLabel, classLabel, filterBrawlers, brawlerFacets, parseBrawlerFilters
│   ├── brawlers.ts            + sortByDisplayName
│   └── queries.ts             + getClub, getBrawlers, getBrawler, getPlayerRankings, getClubRankings, getBrawlerRankings
└── components/
    ├── club/       ClubHeader, ClubStats, ClubMemberList, ClubCompare, CompareForm, CompareResult, CompareSkeleton
    ├── rankings/   RankBadge, LeaderboardList, LeaderboardSkeleton, RankingFilters, RankingSection
    └── brawler/    + BrawlerCard (base común), CatalogTile, BrawlerFiltersForm, BrawlerDetail, BrawlerTopPlayers
apps/web/test/      tests nuevos por tarea; fixtures.ts suma CLUB, CLUB_B, RANKED_*, CATALOG
apps/web/e2e/       clubs, compare, rankings, brawlers y about (.spec.ts); theme.spec.ts suma tema claro
```

Archivos existentes que cambian:
- `NavLinks.tsx`: `isActive('/clubes')` con separador.
- `TagSearch.tsx`: ya no guarda recientes; lo hace la página al cargar.
- `globals.css`: los h2 van en mayúsculas.
- `BrawlerTile.tsx`: usa `BrawlerCard` y la rareza en español.
- `InvalidTag.tsx`: recibe `target`.
- `Footer.tsx`: link a `/acerca`.
- La imagen OG del jugador usa `og.tsx`.
- `README.md`.

---

### Task 1: Base compartida (parámetros de ruta, queries nuevas, marco OG y pendientes del Plan 2)

**Files:**
- Create: `apps/web/src/lib/route-params.ts`, `apps/web/src/lib/og.tsx`, `apps/web/src/lib/rankings.ts` (por ahora solo `RANKING_LIMIT`; la Task 5 completa el archivo)
- Create: `apps/web/src/assets/fonts/Geist-Regular.ttf`, `apps/web/src/assets/fonts/Geist-OFL.txt`
- Modify: `apps/web/src/lib/player-route.ts`, `apps/web/src/lib/queries.ts`, `apps/web/src/app/jugador/[tag]/opengraph-image.tsx` (archivo completo), `apps/web/src/components/layout/NavLinks.tsx` (`isActive`), `apps/web/src/components/search/TagSearch.tsx`, `apps/web/src/app/globals.css`
- Test: `apps/web/test/route-params.test.ts` (nuevo); modifica `apps/web/test/queries.test.ts`, `apps/web/test/layout.test.tsx` y `apps/web/test/search.test.tsx`

**Interfaces:**
- Consumes: `apiGet` (`src/lib/api.ts`); `ClubSchema`, `BrawlerSchema`, `PlayerRankingSchema`, `ClubRankingSchema` de `@brawlwiki/shared`; `DISCLAIMER` (`components/ui/Disclaimer.tsx`).
- Produces:
  - `resolveTag(raw: string): string | null` en `route-params.ts`. `player-route.ts` lo reexporta, así los imports existentes siguen funcionando.
  - `parseBrawlerIdParam(raw: string | undefined): number | null` (solo 8 dígitos)
  - `RANKING_LIMIT = 50` en `src/lib/rankings.ts`
  - Queries en `queries.ts`, todas con `cache()`:
    - `getClub(tag)`
    - `getBrawlers()`
    - `getBrawler(id: number)`
    - `getPlayerRankings(region: string, limit = RANKING_LIMIT)`
    - `getClubRankings(region: string, limit = RANKING_LIMIT)`
    - `getBrawlerRankings(brawlerId: number, region: string, limit = RANKING_LIMIT)`
  - En `og.tsx`:
    - `OG_COLORS`, `OG_DISPLAY` (`'Lilita One'`), `OG_TITLE` y `OG_BOX` (estilos);
    - `ogFonts()`: Geist primero, porque es la fuente del cuerpo; Lilita después, para los títulos;
    - `OgFrame({ children })`: marca arriba, contenido y disclaimer al pie;
    - `OgFallback()`.
  - `isActive(pathname, '/clubes/comparar')`: activo en `/clubes`, `/clubes/...` y `/club/...`, y ya no en `/clubesx`.
  - `TagSearch` ya no llama a `addRecent`. Los recientes los guarda `RecordVisit` cuando el perfil carga de verdad, con nombre, así un tag que da 404 no queda en la lista.
  - Todos los `h2` van en mayúsculas (spec, sección 5: "h2 | Lilita One | 18/24, mayúsculas").

- [ ] **Step 1: Copiar la fuente del cuerpo para las imágenes OG**

Si se le pasa `fonts` a `ImageResponse`, `next/og` **reemplaza** su fuente por defecto (Geist): `options.fonts || defaultFonts` en `node_modules/next/dist/compiled/@vercel/og/index.node.js`. Por eso hoy el cuerpo de la OG del jugador sale en Lilita. Se copia la misma Geist que trae `next/og`, junto con su licencia OFL.

Run:
```bash
cp node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf apps/web/src/assets/fonts/Geist-Regular.ttf
curl -fL -o apps/web/src/assets/fonts/Geist-OFL.txt https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt
ls -l apps/web/src/assets/fonts
```
Expected: `Geist-Regular.ttf` pesa unos 126 KB y `Geist-OFL.txt` empieza con "Copyright 2024 The Geist Project Authors".

- [ ] **Step 2: Escribir los tests que fallan**

`apps/web/test/route-params.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseBrawlerIdParam, resolveTag } from '@/lib/route-params';

describe('route-params', () => {
  it('resolveTag normaliza y parseBrawlerIdParam acepta solo ids de 8 dígitos', () => {
    expect(resolveTag('%232yplq')).toBe('2YPLQ');
    expect(parseBrawlerIdParam('16000000')).toBe(16000000);
    expect(parseBrawlerIdParam('1600000')).toBeNull();
    expect(parseBrawlerIdParam('160000001')).toBeNull();
    expect(parseBrawlerIdParam('16OOOOOO')).toBeNull();
    expect(parseBrawlerIdParam(undefined)).toBeNull();
  });
});
```

En `apps/web/test/queries.test.ts`, agregar al final del archivo:
```ts
describe('rutas de las queries nuevas', () => {
  it('arma las URLs de clubes, brawlers y rankings', async () => {
    const q = await import('@/lib/queries');
    headerMap = new Map();
    await q.getClub('2YPLQ');
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/clubs/2YPLQ');
    await q.getBrawlers();
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/brawlers');
    await q.getBrawler(16000000);
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/brawlers/16000000');
    await q.getPlayerRankings('MX');
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/rankings/players?region=MX&limit=50');
    await q.getClubRankings('global', 10);
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/rankings/clubs?region=global&limit=10');
    await q.getBrawlerRankings(16000001, 'ES', 10);
    expect(apiGet.mock.calls.at(-1)![0]).toBe('/rankings/brawlers/16000001?region=ES&limit=10');
  });
});
```

En `apps/web/test/layout.test.tsx`, dentro de `it('isActive', …)`, agregar después de la última línea `expect`:
```ts
    expect(isActive('/clubes/comparar', '/clubes/comparar')).toBe(true);
    expect(isActive('/clubesx', '/clubes/comparar')).toBe(false);
```

En `apps/web/test/search.test.tsx`, reemplazar el test `it('normaliza " #2pp " y navega al perfil guardando el reciente', …)` completo por:
```tsx
  it('normaliza " #2pp " y navega al perfil sin guardar el reciente (lo guarda el perfil al cargar)', async () => {
    render(<TagSearch />);
    await userEvent.type(screen.getByLabelText('Tag del jugador'), ' #2pp ');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith('/jugador/2PP');
    expect(getRecent()).toEqual([]);
  });
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -w @brawlwiki/web`
Expected: FAIL en estos casos:
- `route-params.test.ts`: "Failed to resolve import @/lib/route-params";
- `queries.test.ts`: `getClub` no existe;
- el `isActive` de `/clubesx`: da `true`;
- el test de `TagSearch`: `getRecent()` no está vacío.

- [ ] **Step 4: Implementar**

`apps/web/src/lib/route-params.ts`:
```ts
import { parseTag } from '@brawlwiki/shared/tags';

/** Normaliza el segmento [tag] de la URL; `null` si no es un tag válido. */
export function resolveTag(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return parseTag(decoded);
}

/** Los ids de brawler de Supercell tienen 8 dígitos (16000000…); cualquier otra cosa da `null`. */
export function parseBrawlerIdParam(raw: string | undefined): number | null {
  return raw !== undefined && /^\d{8}$/.test(raw) ? Number(raw) : null;
}
```

`apps/web/src/lib/player-route.ts` (archivo completo):
```ts
import type { TabItem } from '@/components/ui/Tabs';
import { PLAYER_TABS, type PlayerTab } from './search-params';

export { resolveTag } from './route-params';

const TAB_LABELS: Record<PlayerTab, string> = { resumen: 'Resumen', brawlers: 'Brawlers', partidas: 'Partidas' };

export function playerTabs(tag: string, active: PlayerTab): TabItem[] {
  return PLAYER_TABS.map((t) => ({
    href: t === 'resumen' ? `/jugador/${tag}` : `/jugador/${tag}?tab=${t}`,
    label: TAB_LABELS[t],
    active: t === active,
  }));
}
```

`apps/web/src/lib/rankings.ts` (provisional; la Task 5 lo reemplaza completo):
```ts
/** Cuántos puestos se piden por defecto (la API acepta de 1 a 200). */
export const RANKING_LIMIT = 50;
```

`apps/web/src/lib/queries.ts` (archivo completo):
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
import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { apiGet } from './api';
import { RANKING_LIMIT } from './rankings';

/** Reenvía la IP del usuario tal cual llegó (Nginx la agrega); Express confía solo en loopback. */
async function forwardedFor(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for') ?? h.get('x-real-ip');
}

const enc = encodeURIComponent;

// `cache` deduplica dentro de un mismo request (generateMetadata + página). Next no deduplica
// por su cuenta los fetch que llevan `signal`, y apiGet siempre pasa uno por el timeout.

export const getPlayer = cache(async (tag: string) =>
  apiGet(`/players/${enc(tag)}`, PlayerSchema, { forwardedFor: await forwardedFor() }),
);

export const getBattleLog = cache(async (tag: string) =>
  apiGet(`/players/${enc(tag)}/battlelog`, z.array(BattleSchema), { forwardedFor: await forwardedFor() }),
);

export const getEventRotation = cache(async () =>
  apiGet('/events/rotation', z.array(EventSlotSchema), { forwardedFor: await forwardedFor() }),
);

export const getClub = cache(async (tag: string) =>
  apiGet(`/clubs/${enc(tag)}`, ClubSchema, { forwardedFor: await forwardedFor() }),
);

export const getBrawlers = cache(async () =>
  apiGet('/brawlers', z.array(BrawlerSchema), { forwardedFor: await forwardedFor() }),
);

export const getBrawler = cache(async (id: number) =>
  apiGet(`/brawlers/${id}`, BrawlerSchema, { forwardedFor: await forwardedFor() }),
);

const rankingQuery = (region: string, limit: number) => `?region=${enc(region)}&limit=${limit}`;

export const getPlayerRankings = cache(async (region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/players${rankingQuery(region, limit)}`, z.array(PlayerRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);

export const getClubRankings = cache(async (region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/clubs${rankingQuery(region, limit)}`, z.array(ClubRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);

export const getBrawlerRankings = cache(async (brawlerId: number, region: string, limit: number = RANKING_LIMIT) =>
  apiGet(`/rankings/brawlers/${brawlerId}${rankingQuery(region, limit)}`, z.array(PlayerRankingSchema), {
    forwardedFor: await forwardedFor(),
  }),
);
```
Nota: `cache()` deduplica usando los argumentos **tal como se pasan**, así que `getPlayerRankings('MX')` y `getPlayerRankings('MX', 50)` son entradas distintas. Una página que precarga una query tiene que llamarla con los mismos argumentos que el componente que la consume.

`apps/web/src/lib/og.tsx`:
```tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CSSProperties, ReactNode } from 'react';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

export const OG_COLORS = {
  bg: '#0b0b0f',
  surface: '#15151c',
  border: '#2c2c3a',
  fg: '#f2f2f5',
  muted: '#a1a1b3',
  primary: '#ffc61a',
};
export const OG_DISPLAY = 'Lilita One';
const OG_BODY = 'Geist';

// `next dev` y `next start` corren con cwd = apps/web.
const font = (file: string) => readFile(join(process.cwd(), 'src/assets/fonts', file));
const lilita = font('LilitaOne-Regular.ttf');
const geist = font('Geist-Regular.ttf');

/** Pasar `fonts` a ImageResponse reemplaza la fuente por defecto de next/og: Geist va primero para el cuerpo. */
export async function ogFonts() {
  return [
    { name: OG_BODY, data: await geist, style: 'normal' as const, weight: 400 as const },
    { name: OG_DISPLAY, data: await lilita, style: 'normal' as const, weight: 400 as const },
  ];
}

/** Título grande de una sola línea, cortado con "…" si no entra. */
export const OG_TITLE: CSSProperties = {
  display: 'flex',
  fontFamily: OG_DISPLAY,
  fontSize: 84,
  lineHeight: 1.1,
  maxWidth: 1072,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

/** Caja de dato (valor arriba, etiqueta abajo) que comparten las imágenes OG. */
export const OG_BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: OG_COLORS.surface,
  border: `2px solid ${OG_COLORS.border}`,
  borderRadius: 12,
  padding: '12px 20px',
  marginRight: 16,
};

/** Marco común: marca arriba, contenido en el medio y disclaimer al pie. Satori exige display:flex en cada div con varios hijos. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG_COLORS.bg,
        color: OG_COLORS.fg,
        padding: 64,
        fontFamily: OG_BODY,
      }}
    >
      <div style={{ display: 'flex', fontFamily: OG_DISPLAY, fontSize: 36, color: OG_COLORS.primary }}>BRAWLWIKI</div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, marginTop: 28 }}>{children}</div>
      <div style={{ display: 'flex', fontSize: 22, color: OG_COLORS.muted }}>{DISCLAIMER}</div>
    </div>
  );
}

export function OgFallback() {
  return (
    <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', fontFamily: OG_DISPLAY, fontSize: 72 }}>
      Stats de Brawl Stars
    </div>
  );
}
```

`apps/web/src/app/jugador/[tag]/opengraph-image.tsx` (archivo completo):
```tsx
import { ImageResponse } from 'next/og';
import { attempt } from '@/lib/attempt';
import { sortBrawlers } from '@/lib/brawlers';
import { displayName, formatNumber } from '@/lib/format';
import { OG_BOX, OG_COLORS, OG_DISPLAY, OG_TITLE, OgFallback, OgFrame, ogFonts } from '@/lib/og';
import { getPlayer } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export const alt = 'Perfil de jugador de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getPlayer(tag)) : null;
  const player = r?.ok ? r.value.data : null;
  const top = player ? sortBrawlers(player.brawlers, 'trofeos').slice(0, 3) : [];

  return new ImageResponse(
    (
      <OgFrame>
        {player ? (
          <>
            <div style={OG_TITLE}>{player.name}</div>
            <div style={{ display: 'flex', fontSize: 32, color: OG_COLORS.muted, marginTop: 8 }}>
              {`#${player.tag} · Nivel ${player.expLevel}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: OG_DISPLAY, fontSize: 96, color: OG_COLORS.primary }}>
                {formatNumber(player.trophies)}
              </span>
              <span style={{ fontSize: 32, color: OG_COLORS.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {top.map((b) => (
                <div key={b.id} style={OG_BOX}>
                  <span style={{ fontFamily: OG_DISPLAY, fontSize: 30 }}>{displayName(b.name)}</span>
                  <span style={{ fontSize: 24, color: OG_COLORS.muted }}>{`${formatNumber(b.trophies)} trofeos`}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <OgFallback />
        )}
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
```

En `apps/web/src/components/layout/NavLinks.tsx`, reemplazar la línea de `/clubes/comparar` dentro de `isActive` por:
```ts
  if (href === '/clubes/comparar') {
    return pathname === '/clubes' || pathname.startsWith('/clubes/') || pathname.startsWith('/club/');
  }
```

En `apps/web/src/components/search/TagSearch.tsx`, borrar estas dos líneas:
- `import { addRecent } from '@/lib/local-store';`
- `    addRecent({ type: target, tag });` (dentro de `submit`)

En `apps/web/src/app/globals.css`, agregar justo después de la regla `:focus-visible { … }`:
```css
/* Spec, sección 5: los h2 van en mayúsculas. El tamaño lo sigue poniendo cada componente. */
@layer base {
  h2 {
    text-transform: uppercase;
  }
}
```

- [ ] **Step 5: Correr tests, typecheck, build y E2E, y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web && npm run e2e`
Expected:
- PASS: 75 tests unitarios (73 + 2).
- Typecheck y build OK.
- E2E: 17 passed. Que `TagSearch` ya no guarde recientes no rompe el E2E de recientes, porque `RecordVisit` guarda la visita al cargar el perfil.
- Si `text-transform: uppercase` hiciera fallar algún `getByRole('heading', { name })` de Playwright, reportarlo como DONE_WITH_CONCERNS con la salida, sin cambiar las aserciones. No debería pasar: el nombre accesible sale del DOM, no del CSS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib apps/web/src/assets/fonts apps/web/src/app/jugador apps/web/src/components/layout/NavLinks.tsx apps/web/src/components/search/TagSearch.tsx apps/web/src/app/globals.css apps/web/test
git commit -m "feat(web): queries de clubes, brawlers y rankings; marco OG compartido y pendientes del Plan 2

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 2: Componentes de club (header, stats, miembros)

**Files:**
- Create: `apps/web/src/lib/clubs.ts`
- Create: `apps/web/src/components/club/ClubHeader.tsx`, `ClubStats.tsx`, `ClubMemberList.tsx` (en `apps/web/src/components/club/`)
- Modify: `apps/web/test/fixtures.ts` (cambia el import y agrega `clubMember`, `CLUB` y `CLUB_B` al final)
- Test: `apps/web/test/club.test.tsx`

**Interfaces:**
- Consumes: `Club` y `ClubMember` de shared; `GameImage`, `Card`, `Chip` y `AnimatedNumber` (`components/ui`); `FavoriteButton` (`components/search`); `EmptyState` (`components/states`); `formatNumber` (`lib/format`).
- Produces:
  - `roleLabel(role)`: president → "Presidente", vicePresident → "Vicepresidente", senior → "Veterano", member → "Miembro"; si no lo conoce, devuelve el texto tal cual.
  - `clubTypeLabel(type)`: open → "Abierto", inviteOnly → "Solo por invitación", closed → "Cerrado"; si no lo conoce, devuelve el texto tal cual.
  - `CLUB_CAPACITY = 30`
  - `summarizeClub(club): { members; average; best }`: el promedio entero sale de los trofeos de los miembros; sin miembros da `{ 0, 0, 0 }`.
  - `ClubHeader({ club })`:
    - escudo (`GameImage`) y `h1` con `truncate`;
    - "#TAG · tipo";
    - `FavoriteButton` con `type: 'club'`.
  - `ClubStats({ club })`:
    - trofeos con `AnimatedNumber`;
    - `<dl>` con Miembros "N/30", Promedio y Requeridos;
    - la descripción solo si no está vacía, con `break-words`.
  - `ClubMemberList({ members })`: `<section>` con `h2` "Miembros (N)" y un `<ol>`. Cada fila lleva:
    - posición, ícono y link al perfil (subrayado);
    - "#TAG", trofeos con "trofeos" en `sr-only` y `Chip` con el rol (`accent` para el presidente).

    Sin miembros, muestra `EmptyState` "Este club no tiene miembros".
  - `test/fixtures.ts`:
    - `clubMember(overrides?)`;
    - `CLUB`: Los Cracks, 3 miembros, 83,610 trofeos (la suma de los miembros);
    - `CLUB_B`: Titanes, 2 miembros, 83,000 trofeos.

- [ ] **Step 1: Ampliar los fixtures y escribir el test que falla**

En `apps/web/test/fixtures.ts`, reemplazar la primera línea por:
```ts
import type { Battle, BattlePlayer, Club, ClubMember, Player, PlayerBrawler } from '@brawlwiki/shared';
```
y agregar al final del archivo:
```ts
export function clubMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    tag: '2PP',
    name: 'EzyPlayer',
    nameColor: null,
    role: 'member',
    trophies: 1000,
    icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
    ...overrides,
  };
}

export const CLUB: Club = {
  tag: '2YPLQ',
  name: 'Los Cracks',
  description: 'Club de prueba. ¡Activos diario!',
  type: 'inviteOnly',
  badgeId: 8000000,
  badgeImageUrl: 'https://cdn.brawlify.com/club-badges/regular/8000000.png',
  requiredTrophies: 25000,
  trophies: 83610,
  members: [
    clubMember({ tag: '2PP', name: 'EzyPlayer', role: 'president', trophies: 42310 }),
    clubMember({ tag: 'Y2YY', name: 'Mika', role: 'vicePresident', trophies: 40100 }),
    clubMember({ tag: '8QU', name: 'SinClub', role: 'member', trophies: 1200 }),
  ],
};

export const CLUB_B: Club = {
  tag: '8CGRV',
  name: 'Titanes',
  description: '',
  type: 'open',
  badgeId: 8000010,
  badgeImageUrl: 'https://cdn.brawlify.com/club-badges/regular/8000010.png',
  requiredTrophies: 30000,
  trophies: 83000,
  members: [
    clubMember({ tag: 'QQQ', name: 'Rival2', role: 'president', trophies: 45000 }),
    clubMember({ tag: 'PPP', name: 'Rival1', role: 'member', trophies: 38000 }),
  ],
};
```

`apps/web/test/club.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClubHeader } from '@/components/club/ClubHeader';
import { ClubMemberList } from '@/components/club/ClubMemberList';
import { ClubStats } from '@/components/club/ClubStats';
import { clubTypeLabel, roleLabel, summarizeClub } from '@/lib/clubs';
import { CLUB, CLUB_B } from './fixtures';

describe('clubs', () => {
  it('traduce roles y tipos, y deja tal cual lo desconocido', () => {
    expect(roleLabel('president')).toBe('Presidente');
    expect(roleLabel('vicePresident')).toBe('Vicepresidente');
    expect(roleLabel('senior')).toBe('Veterano');
    expect(roleLabel('newRole')).toBe('newRole');
    expect(clubTypeLabel('inviteOnly')).toBe('Solo por invitación');
    expect(clubTypeLabel('unknown')).toBe('unknown');
  });

  it('summarizeClub: miembros, promedio y mejor; un club vacío da 0 y no NaN', () => {
    expect(summarizeClub(CLUB)).toEqual({ members: 3, average: 27870, best: 42310 });
    expect(summarizeClub({ ...CLUB, members: [] })).toEqual({ members: 0, average: 0, best: 0 });
  });
});

describe('componentes de club', () => {
  it('ClubHeader: nombre truncable, tag, tipo y favorito de club', () => {
    render(<ClubHeader club={CLUB} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Los Cracks' })).toHaveClass('truncate');
    expect(screen.getByText('#2YPLQ · Solo por invitación')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Escudo de Los Cracks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
  });

  it('ClubStats: trofeos, miembros sobre 30, promedio, requeridos y descripción solo si existe', () => {
    const { unmount } = render(<ClubStats club={CLUB} />);
    expect(screen.getByText('83,610', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('3/30')).toBeInTheDocument();
    expect(screen.getByText('27,870')).toBeInTheDocument();
    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByText('Club de prueba. ¡Activos diario!')).toBeInTheDocument();
    unmount();
    const { container } = render(<ClubStats club={CLUB_B} />);
    expect(container.querySelector('[data-club-description]')).toBeNull();
  });

  it('ClubMemberList: orden, link al perfil, rol en texto y trofeos', () => {
    render(<ClubMemberList members={CLUB.members} />);
    expect(screen.getByRole('heading', { name: 'Miembros (3)' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByRole('link', { name: 'EzyPlayer' })).toHaveAttribute('href', '/jugador/2PP');
    expect(within(items[0]!).getByText('Presidente')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Vicepresidente')).toBeInTheDocument();
    expect(within(items[2]!).getByText('1,200')).toBeInTheDocument();
  });

  it('ClubMemberList vacío → estado vacío', () => {
    render(<ClubMemberList members={[]} />);
    expect(screen.getByText('Este club no tiene miembros')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- club`
Expected: FAIL, "Failed to resolve import @/components/club/ClubHeader".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/clubs.ts`:
```ts
import type { Club } from '@brawlwiki/shared';

const ROLES: Record<string, string> = {
  president: 'Presidente',
  vicePresident: 'Vicepresidente',
  senior: 'Veterano',
  member: 'Miembro',
};

const TYPES: Record<string, string> = {
  open: 'Abierto',
  inviteOnly: 'Solo por invitación',
  closed: 'Cerrado',
};

export function roleLabel(role: string): string {
  return ROLES[role] ?? role;
}

export function clubTypeLabel(type: string): string {
  return TYPES[type] ?? type;
}

export const CLUB_CAPACITY = 30;

export interface ClubSummary {
  members: number;
  average: number;
  best: number;
}

/** Promedio entero sobre los miembros listados; un club sin miembros da 0, nunca NaN. */
export function summarizeClub(club: Club): ClubSummary {
  const n = club.members.length;
  if (n === 0) return { members: 0, average: 0, best: 0 };
  const total = club.members.reduce((sum, m) => sum + m.trophies, 0);
  return { members: n, average: Math.round(total / n), best: Math.max(...club.members.map((m) => m.trophies)) };
}
```

`apps/web/src/components/club/ClubHeader.tsx`:
```tsx
import type { Club } from '@brawlwiki/shared';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { GameImage } from '@/components/ui/GameImage';
import { clubTypeLabel } from '@/lib/clubs';

export function ClubHeader({ club }: { club: Club }) {
  return (
    <header className="mt-4 flex items-center gap-3">
      <GameImage
        src={club.badgeImageUrl}
        alt={`Escudo de ${club.name}`}
        size={56}
        fallbackText={club.name}
        className="rounded-card"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl">{club.name}</h1>
        <p className="truncate text-sm text-muted">
          #{club.tag} · {clubTypeLabel(club.type)}
        </p>
      </div>
      <FavoriteButton entry={{ type: 'club', tag: club.tag, name: club.name }} />
    </header>
  );
}
```

`apps/web/src/components/club/ClubStats.tsx`:
```tsx
import type { Club } from '@brawlwiki/shared';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { CLUB_CAPACITY, summarizeClub } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

export function ClubStats({ club }: { club: Club }) {
  const s = summarizeClub(club);
  const stats = [
    { label: 'Miembros', value: `${s.members}/${CLUB_CAPACITY}` },
    { label: 'Promedio', value: formatNumber(s.average) },
    { label: 'Requeridos', value: formatNumber(club.requiredTrophies) },
  ];
  return (
    <section aria-label="Estadísticas del club">
      <Card>
        <p className="text-[11px] font-bold tracking-wider text-muted">TROFEOS</p>
        <AnimatedNumber value={club.trophies} className="font-display text-3xl text-primary" />
      </Card>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <div key={st.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{st.label}</dt>
            <dd className="font-display text-lg tabular-nums">{st.value}</dd>
          </div>
        ))}
      </dl>
      {club.description && (
        <p data-club-description className="mt-3 whitespace-pre-line break-words text-sm text-muted">
          {club.description}
        </p>
      )}
    </section>
  );
}
```

`apps/web/src/components/club/ClubMemberList.tsx`:
```tsx
import type { ClubMember } from '@brawlwiki/shared';
import Link from 'next/link';
import { EmptyState } from '@/components/states/EmptyState';
import { Chip } from '@/components/ui/Chip';
import { GameImage } from '@/components/ui/GameImage';
import { roleLabel } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

export function ClubMemberList({ members }: { members: ClubMember[] }) {
  return (
    <section aria-labelledby="miembros-title" className="min-w-0">
      <h2 id="miembros-title" className="mb-2 font-display text-lg">
        Miembros <span className="text-sm text-muted">({members.length})</span>
      </h2>
      {members.length === 0 ? (
        <EmptyState title="Este club no tiene miembros" />
      ) : (
        <ol className="divide-y divide-border rounded-card border border-border bg-surface">
          {members.map((m, i) => (
            <li key={m.tag} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">{i + 1}</span>
              <GameImage
                src={m.icon.imageUrl}
                alt={`Ícono de ${m.name}`}
                size={36}
                fallbackText={m.name}
                className="rounded-chip"
              />
              <span className="min-w-0 flex-1">
                <Link href={`/jugador/${m.tag}`} className="block truncate font-semibold underline underline-offset-2">
                  {m.name}
                </Link>
                <span className="block truncate text-xs text-muted">#{m.tag}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-display tabular-nums">
                  {formatNumber(m.trophies)}
                  <span className="sr-only"> trofeos</span>
                </span>
                <Chip tone={m.role === 'president' ? 'accent' : 'neutral'}>{roleLabel(m.role)}</Chip>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (81 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/clubs.ts apps/web/src/components/club apps/web/test/fixtures.ts apps/web/test/club.test.tsx
git commit -m "feat(web): componentes de club (header con favorito, stats y lista de miembros)

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 3: Página del club (`/club/[tag]`) + imagen OG del club

**Files:**
- Modify: `apps/web/src/components/player/InvalidTag.tsx` (archivo completo: recibe `target`)
- Create: `apps/web/src/app/club/[tag]/page.tsx`, `loading.tsx`, `not-found.tsx`, `opengraph-image.tsx`
- Test: `apps/web/test/club-page.test.tsx`

**Interfaces:**
- Consumes:
  - `getClub` y `resolveTag` (Task 1);
  - `OgFrame`, `OgFallback`, `ogFonts`, `OG_*` (Task 1);
  - `ClubHeader`, `ClubStats`, `ClubMemberList`, `summarizeClub`, `clubTypeLabel` y `CLUB_CAPACITY` (Task 2);
  - de los componentes existentes: `RecordVisit`, `StaleBadge`, `ApiErrorView`, `ButtonLink`, `Skeleton`, `TagSearch` y `attempt`.
- Produces:
  - `InvalidTag({ target?: 'player' | 'club' })`: mismo texto de antes; el `TagSearch` usa ese `target` (por defecto `'player'`).
  - `/club/[tag]`:
    - tag inválido → `InvalidTag target="club"`;
    - tag no canónico → `redirect` a `/club/TAG`;
    - `NOT_FOUND` → `notFound()`; `INVALID_TAG` → `InvalidTag`; cualquier otro error → `ApiErrorView`;
    - con datos: `RecordVisit` (`type: 'club'`), `ClubHeader`, `StaleBadge`, `ClubStats`, el botón "Comparar con otro club" (`/clubes/comparar?a=TAG`) y `ClubMemberList`;
    - desde `lg`, stats a la izquierda y miembros a la derecha.
  - `generateMetadata`:
    - con datos: título "Nombre (#TAG)" y descripción con trofeos y miembros;
    - si hay error: "Club #TAG";
    - si el tag es inválido: "Tag inválido".
  - `loading.tsx`: `role="status"`, `aria-label="Cargando club"`.
  - `not-found.tsx`: `h1` "No encontramos ese club" + `TagSearch target="club"`.
  - `opengraph-image.tsx`: nombre, "#TAG · tipo", trofeos y 3 cajas (Miembros, Promedio, Requeridos). Si hay error, `OgFallback`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/club-page.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClubNotFound from '@/app/club/[tag]/not-found';
import { InvalidTag } from '@/components/player/InvalidTag';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('página de club', () => {
  it('InvalidTag de club ofrece buscar un club', () => {
    render(<InvalidTag target="club" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tag del club')).toBeInTheDocument();
  });

  it('el 404 del club explica y ofrece buscar otro club', () => {
    render(<ClubNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos ese club' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tag del club')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- club-page`
Expected: FAIL, "Failed to resolve import @/app/club/[tag]/not-found".

- [ ] **Step 3: Implementar**

`apps/web/src/components/player/InvalidTag.tsx` (archivo completo):
```tsx
import { TagSearch } from '@/components/search/TagSearch';

export function InvalidTag({ target = 'player' }: { target?: 'player' | 'club' }) {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">Tag inválido</h1>
      <p className="mt-2 text-sm text-muted">
        Los tags de Brawl Stars solo usan estos caracteres:{' '}
        <strong className="font-mono tracking-wider text-fg">0289PYLQGRJCUV</strong>. Si ves una letra O, en realidad es
        un cero (0).
      </p>
      <div className="mt-4 text-left">
        <TagSearch variant="hero" target={target} />
      </div>
    </div>
  );
}
```

`apps/web/src/app/club/[tag]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ClubHeader } from '@/components/club/ClubHeader';
import { ClubMemberList } from '@/components/club/ClubMemberList';
import { ClubStats } from '@/components/club/ClubStats';
import { InvalidTag } from '@/components/player/InvalidTag';
import { RecordVisit } from '@/components/search/RecordVisit';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { ButtonLink } from '@/components/ui/Button';
import { attempt } from '@/lib/attempt';
import { CLUB_CAPACITY } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';
import { getClub } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export async function generateMetadata({ params }: PageProps<'/club/[tag]'>): Promise<Metadata> {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return { title: 'Tag inválido' };
  if (tag !== raw) return {}; // la página redirige al tag canónico
  const r = await attempt(getClub(tag));
  if (!r.ok) return { title: `Club #${tag}` };
  const c = r.value.data;
  return {
    title: `${c.name} (#${c.tag})`,
    description: `Club de Brawl Stars · ${formatNumber(c.trophies)} trofeos · ${c.members.length}/${CLUB_CAPACITY} miembros.`,
  };
}

export default async function ClubPage({ params }: PageProps<'/club/[tag]'>) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return <InvalidTag target="club" />;
  if (tag !== raw) redirect(`/club/${tag}`);

  const r = await attempt(getClub(tag));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND') notFound();
    if (r.error.code === 'INVALID_TAG') return <InvalidTag target="club" />;
    return <ApiErrorView error={r.error} />;
  }

  const { data: club, meta } = r.value;
  return (
    <>
      <RecordVisit entry={{ type: 'club', tag: club.tag, name: club.name }} />
      <ClubHeader club={club} />
      <StaleBadge meta={meta} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div>
          <ClubStats club={club} />
          <ButtonLink href={`/clubes/comparar?a=${club.tag}`} variant="secondary" className="mt-3 w-full">
            Comparar con otro club
          </ButtonLink>
        </div>
        <ClubMemberList members={club.members} />
      </div>
    </>
  );
}
```

`apps/web/src/app/club/[tag]/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando club" className="mt-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-card" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="mt-4 h-[76px]" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px]" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
```

`apps/web/src/app/club/[tag]/not-found.tsx`:
```tsx
import { TagSearch } from '@/components/search/TagSearch';

export default function ClubNotFound() {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese club</h1>
      <p className="mb-4 mt-2 text-sm text-muted">
        Revisa el tag en la pantalla del club dentro del juego. Si el club se cerró, ya no aparece.
      </p>
      <div className="text-left">
        <TagSearch variant="hero" target="club" />
      </div>
    </div>
  );
}
```

`apps/web/src/app/club/[tag]/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og';
import { attempt } from '@/lib/attempt';
import { CLUB_CAPACITY, clubTypeLabel, summarizeClub } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';
import { OG_BOX, OG_COLORS, OG_DISPLAY, OG_TITLE, OgFallback, OgFrame, ogFonts } from '@/lib/og';
import { getClub } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export const alt = 'Club de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getClub(tag)) : null;
  const club = r?.ok ? r.value.data : null;
  const s = club ? summarizeClub(club) : null;

  return new ImageResponse(
    (
      <OgFrame>
        {club && s ? (
          <>
            <div style={OG_TITLE}>{club.name}</div>
            <div style={{ display: 'flex', fontSize: 32, color: OG_COLORS.muted, marginTop: 8 }}>
              {`#${club.tag} · ${clubTypeLabel(club.type)}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: OG_DISPLAY, fontSize: 96, color: OG_COLORS.primary }}>
                {formatNumber(club.trophies)}
              </span>
              <span style={{ fontSize: 32, color: OG_COLORS.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {[
                { label: 'Miembros', value: `${s.members}/${CLUB_CAPACITY}` },
                { label: 'Promedio', value: formatNumber(s.average) },
                { label: 'Requeridos', value: formatNumber(club.requiredTrophies) },
              ].map((box) => (
                <div key={box.label} style={OG_BOX}>
                  <span style={{ fontFamily: OG_DISPLAY, fontSize: 30 }}>{box.value}</span>
                  <span style={{ fontSize: 24, color: OG_COLORS.muted }}>{box.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <OgFallback />
        )}
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
```

- [ ] **Step 4: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected:
- PASS: 83 tests.
- Typecheck limpio: `next typegen` genera `PageProps<'/club/[tag]'>`.
- Build OK, con `/club/[tag]` y `/club/[tag]/opengraph-image` como rutas dinámicas (ƒ).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/player/InvalidTag.tsx apps/web/src/app/club apps/web/test/club-page.test.tsx
git commit -m "feat(web): página de club con miembros, favorito, 404, tag inválido e imagen OG

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 4: Comparador de clubes (`/clubes/comparar`)

**Files:**
- Modify: `apps/web/src/lib/clubs.ts` (agrega `compareClubs`, `parseCompareParams`)
- Create: `apps/web/src/components/club/ClubCompare.tsx`, `CompareForm.tsx`, `CompareResult.tsx`, `CompareSkeleton.tsx`
- Create: `apps/web/src/app/clubes/comparar/page.tsx`
- Test: `apps/web/test/compare.test.tsx`

**Interfaces:**
- Consumes: `summarizeClub` (Task 2); `getClub` (Task 1); `parseTag` de `@brawlwiki/shared/tags`; `GameImage`, `Button`, `Skeleton` (`ui`); `StaleBadge`, `ApiErrorView`, `EmptyState` (`states`); `TagSearch`; `attempt`; `first` (`lib/search-params`); `formatNumber`.
- Produces:
  - `type Side = 'a' | 'b'`
  - `interface CompareMetric { label: string; a: number; b: number; winner: Side | null }`
  - `compareClubs(a, b): CompareMetric[]`: devuelve, en orden, Trofeos totales, Miembros, Promedio por miembro, Mejor jugador y Trofeos requeridos. `winner` es el lado con el valor **mayor**, o `null` si empatan.
  - `interface CompareParams { a: string | null; b: string | null; rawA: string; rawB: string; errors: { a?: string; b?: string } }`
  - `parseCompareParams(rawA = '', rawB = '')`:
    - un campo vacío no es error;
    - un tag inválido da `COMPARE_INVALID`;
    - si los dos tags son iguales, `errors.b` es "Elige un club distinto al Club A.".
  - `COMPARE_INVALID = 'Tag inválido. Usa solo 0289PYLQGRJCUV (la letra O cuenta como cero).'`
  - `ClubCompare({ a, b })`:
    - encabezado con los dos clubes (escudo y link a `/club/TAG`);
    - un `<ul>` con una tarjeta por métrica: `h3` con la etiqueta y, por cada club, nombre, valor (`formatNumber`) y una barra `aria-hidden` con el ancho relativo al mayor;
    - el lado mayor lleva el texto "Mayor" (con "▲" en `aria-hidden`).
  - `CompareForm({ a, b, errors })`:
    - `<form method="get" action="/clubes/comparar">` con dos inputs (`name="a"` y `name="b"`) con label "Club A" y "Club B";
    - el error de cada campo va en línea con `role="alert"` y `aria-invalid`;
    - botón "Comparar".
  - `CompareResult({ a, b })` (async): pide los dos clubes en paralelo.
    - Si los dos responden, muestra `StaleBadge` (el más viejo de los stale) y `ClubCompare`.
    - Si no, muestra el problema de cada lado: `NOT_FOUND` da `EmptyState` "No encontramos el club #TAG" y el resto, `ApiErrorView`.
  - `CompareSkeleton()`: `role="status"`, `aria-label="Cargando comparación"`.
  - `/clubes/comparar`:
    - `h1` "Clubes";
    - sección "Buscar un club" (`TagSearch target="club"`);
    - sección "Comparar dos clubes" con `CompareForm` y, si los dos tags son válidos y distintos, `<Suspense>` con `CompareResult`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/compare.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClubCompare } from '@/components/club/ClubCompare';
import { CompareForm } from '@/components/club/CompareForm';
import { COMPARE_INVALID, compareClubs, parseCompareParams } from '@/lib/clubs';
import { CLUB, CLUB_B } from './fixtures';

describe('compareClubs', () => {
  it('compara cinco métricas y marca el lado mayor', () => {
    expect(compareClubs(CLUB, CLUB_B)).toEqual([
      { label: 'Trofeos totales', a: 83610, b: 83000, winner: 'a' },
      { label: 'Miembros', a: 3, b: 2, winner: 'a' },
      { label: 'Promedio por miembro', a: 27870, b: 41500, winner: 'b' },
      { label: 'Mejor jugador', a: 42310, b: 45000, winner: 'b' },
      { label: 'Trofeos requeridos', a: 25000, b: 30000, winner: 'b' },
    ]);
  });

  it('empates sin ganador y club vacío sin NaN', () => {
    expect(compareClubs(CLUB, CLUB).every((m) => m.winner === null)).toBe(true);
    const empty = { ...CLUB_B, members: [] };
    const metrics = compareClubs(CLUB, empty);
    expect(metrics.find((m) => m.label === 'Promedio por miembro')).toEqual({
      label: 'Promedio por miembro',
      a: 27870,
      b: 0,
      winner: 'a',
    });
    expect(metrics.some((m) => Number.isNaN(m.a) || Number.isNaN(m.b))).toBe(false);
  });
});

describe('parseCompareParams', () => {
  it('normaliza, valida cada campo y rechaza el mismo club dos veces', () => {
    expect(parseCompareParams()).toEqual({ a: null, b: null, rawA: '', rawB: '', errors: {} });
    expect(parseCompareParams(' #2yplq ', '8cgrv')).toEqual({
      a: '2YPLQ',
      b: '8CGRV',
      rawA: ' #2yplq ',
      rawB: '8cgrv',
      errors: {},
    });
    expect(parseCompareParams('hola', '').errors).toEqual({ a: COMPARE_INVALID });
    expect(parseCompareParams('2YPLQ', '#2yplq').errors).toEqual({ b: 'Elige un club distinto al Club A.' });
  });
});

describe('componentes del comparador', () => {
  it('ClubCompare: una tarjeta por métrica, valores visibles y "Mayor" en texto', () => {
    render(<ClubCompare a={CLUB} b={CLUB_B} />);
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.getByRole('link', { name: 'Titanes' })).toHaveAttribute('href', '/club/8CGRV');
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    const first = within(cards[0]!);
    expect(first.getByRole('heading', { name: 'Trofeos totales' })).toBeInTheDocument();
    expect(first.getByText('83,610')).toBeInTheDocument();
    expect(first.getByText('83,000')).toBeInTheDocument();
    expect(first.getAllByText('Mayor')).toHaveLength(1);
  });

  it('CompareForm: GET nativo, valores previos y error en línea por campo', () => {
    const { container } = render(<CompareForm a="hola" b="8CGRV" errors={{ a: COMPARE_INVALID }} />);
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/clubes/comparar');
    expect(screen.getByLabelText('Club A')).toHaveValue('hola');
    expect(screen.getByLabelText('Club A')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Club B')).toHaveValue('8CGRV');
    expect(screen.getByLabelText('Club B')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('0289PYLQGRJCUV');
    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveAttribute('type', 'submit');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- compare`
Expected: FAIL, "Failed to resolve import @/components/club/ClubCompare".

- [ ] **Step 3: Implementar**

En `apps/web/src/lib/clubs.ts`, agregar `import { parseTag } from '@brawlwiki/shared/tags';` junto al import existente y esto al final del archivo:
```ts
export type Side = 'a' | 'b';

export interface CompareMetric {
  label: string;
  a: number;
  b: number;
  winner: Side | null;
}

/** "winner" marca el valor mayor (no siempre "mejor": más trofeos requeridos es más exigente). */
export function compareClubs(a: Club, b: Club): CompareMetric[] {
  const sa = summarizeClub(a);
  const sb = summarizeClub(b);
  const rows: [string, number, number][] = [
    ['Trofeos totales', a.trophies, b.trophies],
    ['Miembros', sa.members, sb.members],
    ['Promedio por miembro', sa.average, sb.average],
    ['Mejor jugador', sa.best, sb.best],
    ['Trofeos requeridos', a.requiredTrophies, b.requiredTrophies],
  ];
  return rows.map(([label, va, vb]) => ({ label, a: va, b: vb, winner: va === vb ? null : va > vb ? 'a' : 'b' }));
}

export const COMPARE_INVALID = 'Tag inválido. Usa solo 0289PYLQGRJCUV (la letra O cuenta como cero).';

export interface CompareParams {
  a: string | null;
  b: string | null;
  rawA: string;
  rawB: string;
  errors: { a?: string; b?: string };
}

export function parseCompareParams(rawA = '', rawB = ''): CompareParams {
  const a = rawA.trim() ? parseTag(rawA) : null;
  const b = rawB.trim() ? parseTag(rawB) : null;
  const errors: CompareParams['errors'] = {};
  if (rawA.trim() && !a) errors.a = COMPARE_INVALID;
  if (rawB.trim() && !b) errors.b = COMPARE_INVALID;
  else if (a && b && a === b) errors.b = 'Elige un club distinto al Club A.';
  return { a, b, rawA, rawB, errors };
}
```

`apps/web/src/components/club/ClubCompare.tsx`:
```tsx
import type { Club } from '@brawlwiki/shared';
import Link from 'next/link';
import { GameImage } from '@/components/ui/GameImage';
import { compareClubs, type Side } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';

const SIDES: Side[] = ['a', 'b'];

export function ClubCompare({ a, b }: { a: Club; b: Club }) {
  const clubs = { a, b };
  const metrics = compareClubs(a, b);
  return (
    <section aria-labelledby="comparacion-title" className="mt-6">
      <h2 id="comparacion-title" className="sr-only">
        Comparación
      </h2>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {SIDES.map((side) => (
          <div key={side} className="flex min-w-0 items-center gap-2 rounded-card bg-surface-2 p-2">
            <GameImage
              src={clubs[side].badgeImageUrl}
              alt={`Escudo de ${clubs[side].name}`}
              size={32}
              fallbackText={clubs[side].name}
              className="rounded-chip"
            />
            <Link href={`/club/${clubs[side].tag}`} className="min-w-0 truncate font-display underline underline-offset-2">
              {clubs[side].name}
            </Link>
          </div>
        ))}
      </div>
      <ul className="space-y-3">
        {metrics.map((m) => {
          const max = Math.max(m.a, m.b);
          return (
            <li key={m.label} className="rounded-card border border-border bg-surface p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{m.label}</h3>
              {SIDES.map((side) => {
                const value = m[side];
                const lead = m.winner === side;
                const pct = max > 0 ? Math.round((value / max) * 100) : 0;
                return (
                  <div key={side} className="mt-2">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{clubs[side].name}</span>
                      <span className="shrink-0 font-bold tabular-nums">
                        {formatNumber(value)}
                        {lead && (
                          <span className="ml-1 text-xs text-primary">
                            <span aria-hidden="true">▲ </span>
                            Mayor
                          </span>
                        )}
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-surface-2">
                      <div
                        className={`h-2 rounded-full ${lead ? 'bg-primary-fill' : 'bg-muted'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`apps/web/src/components/club/CompareForm.tsx`:
```tsx
import { Button } from '@/components/ui/Button';

interface FieldProps {
  name: 'a' | 'b';
  label: string;
  value: string;
  error?: string;
}

function Field({ name, label, value, error }: FieldProps) {
  const id = `club-${name}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={value}
        placeholder="#2YPLQ"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

/** Formulario GET nativo: funciona sin JavaScript y antes de hidratar. */
export function CompareForm({ a, b, errors }: { a: string; b: string; errors: { a?: string; b?: string } }) {
  return (
    <form method="get" action="/clubes/comparar" className="rounded-card border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="a" label="Club A" value={a} error={errors.a} />
        <Field name="b" label="Club B" value={b} error={errors.b} />
      </div>
      <Button type="submit" className="mt-3 w-full sm:w-auto">
        Comparar
      </Button>
    </form>
  );
}
```

`apps/web/src/components/club/CompareSkeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export function CompareSkeleton() {
  return (
    <div role="status" aria-label="Cargando comparación" className="mt-6 space-y-3">
      <Skeleton className="h-12" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}
```

`apps/web/src/components/club/CompareResult.tsx`:
```tsx
import type { Meta } from '@brawlwiki/shared';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import type { ApiError } from '@/lib/api';
import { attempt } from '@/lib/attempt';
import { getClub } from '@/lib/queries';
import { ClubCompare } from './ClubCompare';

function SideError({ tag, error }: { tag: string; error: ApiError }) {
  if (error.code === 'NOT_FOUND') {
    return <EmptyState title={`No encontramos el club #${tag}`}>Revisa el tag e inténtalo de nuevo.</EmptyState>;
  }
  return <ApiErrorView error={error} />;
}

/** El más viejo de los dos datos stale, si hay alguno. */
function oldestStale(metas: Meta[]): Meta | undefined {
  return metas.filter((m) => m.source === 'stale').sort((x, y) => y.ageSeconds - x.ageSeconds)[0];
}

export async function CompareResult({ a, b }: { a: string; b: string }) {
  const [ra, rb] = await Promise.all([attempt(getClub(a)), attempt(getClub(b))]);
  if (ra.ok && rb.ok) {
    const stale = oldestStale([ra.value.meta, rb.value.meta]);
    return (
      <>
        {stale && <StaleBadge meta={stale} />}
        <ClubCompare a={ra.value.data} b={rb.value.data} />
      </>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {!ra.ok && <SideError tag={a} error={ra.error} />}
      {!rb.ok && <SideError tag={b} error={rb.error} />}
    </div>
  );
}
```

`apps/web/src/app/clubes/comparar/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareForm } from '@/components/club/CompareForm';
import { CompareResult } from '@/components/club/CompareResult';
import { CompareSkeleton } from '@/components/club/CompareSkeleton';
import { TagSearch } from '@/components/search/TagSearch';
import { parseCompareParams } from '@/lib/clubs';
import { first } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Clubes',
  description: 'Busca un club de Brawl Stars o compara dos clubes lado a lado.',
};

export default async function ClubsPage({ searchParams }: PageProps<'/clubes/comparar'>) {
  const sp = await searchParams;
  const p = parseCompareParams(first(sp.a), first(sp.b));
  const ready = p.a !== null && p.b !== null && !p.errors.a && !p.errors.b;

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Clubes</h1>
      <section aria-labelledby="buscar-club" className="mt-4 rounded-card border border-border bg-surface p-4">
        <h2 id="buscar-club" className="mb-2 font-display text-lg">
          Buscar un club
        </h2>
        <TagSearch variant="hero" target="club" />
      </section>
      <section aria-labelledby="comparar-title" className="mt-6">
        <h2 id="comparar-title" className="mb-2 font-display text-lg">
          Comparar dos clubes
        </h2>
        <CompareForm a={p.rawA} b={p.rawB} errors={p.errors} />
        {ready && (
          <Suspense key={`${p.a}-${p.b}`} fallback={<CompareSkeleton />}>
            <CompareResult a={p.a!} b={p.b!} />
          </Suspense>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 4: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (88 tests), typecheck limpio y build OK con `/clubes/comparar` como ruta dinámica.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/clubs.ts apps/web/src/components/club apps/web/src/app/clubes apps/web/test/compare.test.tsx
git commit -m "feat(web): comparador de clubes con formulario GET, métricas con barras y errores por lado

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 5: Componentes de rankings (regiones, podio, tabla y filtros)

**Files:**
- Modify: `apps/web/src/lib/rankings.ts` (archivo completo)
- Create: `apps/web/src/components/rankings/RankBadge.tsx`, `LeaderboardList.tsx`, `LeaderboardSkeleton.tsx`, `RankingFilters.tsx`
- Modify: `apps/web/test/fixtures.ts` (cambia el import y agrega `RANKED_PLAYERS` y `RANKED_CLUBS` al final)
- Test: `apps/web/test/rankings.test.tsx`

**Interfaces:**
- Consumes: `PlayerRanking`, `ClubRanking` de shared; `TabItem` (`ui/Tabs`); `GameImage`, `Button`, `Skeleton` (`ui`); `formatNumber`, `displayName` (`lib/format`).
- Produces (`lib/rankings.ts`):
  - `RANKING_LIMIT = 50`, que se mantiene de la Task 1.
  - `RANKING_TYPES = ['jugadores', 'clubes', 'brawler']`, `type RankingType` y `parseRankingType(v)`, que por defecto da `'jugadores'`.
  - `parseRegion(v)`: devuelve `'global'` o un código ISO2 en mayúsculas. Con un valor vacío o mal formado, devuelve `'global'`.
  - `REGIONS`: la lista curada de países (hispanohablantes y principales).
  - `regionLabel(code)`: "Global" o el nombre en español según `Intl.DisplayNames('es')`. Por ejemplo, MX → "México".
  - `regionOptions(current): { value; label }[]`: Global primero y el resto ordenado por nombre. Incluye la región actual aunque no esté en la lista.
  - `interface RankingView { tipo: RankingType; region: string; brawler: number | null }`
  - `rankingsHref(view)`: `/rankings?tipo=…`, que solo incluye `region` si no es global y `brawler` solo cuando `tipo` es `brawler`.
  - `rankingTabs(view): TabItem[]`: las pestañas "Jugadores", "Clubes" y "Por brawler", conservando la región.
  - `rankingSubtitle(region, brawlerName?)`: "Top 50 · Global" o "Top 50 · México · Shelly".
- Componentes:
  - `RankBadge({ rank })`: círculo con el número y "Puesto" en `sr-only`. Del 1 al 3 lleva color de podio (oro `#ffc61a`, plata `#c0c6d0`, bronce `#cd7f32`, con texto `#14110a`, contraste ≥ 6:1). El número siempre está, así que el color nunca es la única señal.
  - `LeaderboardList(props: { kind: 'players'; items: PlayerRanking[] } | { kind: 'clubs'; items: ClubRanking[] })`: es un solo `<ol>`, sin DOM duplicado.
    - En móvil, cada fila es: puesto, ícono, nombre (link) con club o miembros debajo, y trofeos.
    - Desde `md`, las mismas filas se acomodan en 4 columnas, con una fila de encabezados `aria-hidden`.
    - Jugadores linkean a `/jugador/TAG` y muestran el club o "Sin club"; clubes linkean a `/club/TAG` y muestran "N miembros".
  - `LeaderboardSkeleton({ rows = 8 })`: `role="status"`, `aria-label="Cargando ranking"`.
  - `RankingFilters({ tipo, region, brawler, brawlers })`: `<form method="get" action="/rankings">` con:
    - `tipo` como input oculto;
    - un select "Región";
    - un select "Brawler", solo cuando `tipo` es `brawler`, con la opción vacía "Elige un brawler";
    - el botón "Ver ranking".
- `test/fixtures.ts`: `RANKED_PLAYERS` (3 jugadores, igual que el fixture de la API) y `RANKED_CLUBS` (2 clubes).

- [ ] **Step 1: Ampliar los fixtures y escribir el test que falla**

En `apps/web/test/fixtures.ts`, reemplazar la primera línea por:
```ts
import type {
  Battle,
  BattlePlayer,
  Club,
  ClubMember,
  ClubRanking,
  Player,
  PlayerBrawler,
  PlayerRanking,
} from '@brawlwiki/shared';
```
y agregar al final del archivo:
```ts
const icon = (id: number) => ({ id, imageUrl: `https://cdn.brawlify.com/profile-icons/regular/${id}.png` });

export const RANKED_PLAYERS: PlayerRanking[] = [
  { rank: 1, tag: 'YYYY', name: 'xXProXx', nameColor: null, trophies: 98410, icon: icon(28000010), clubName: 'Tribe' },
  { rank: 2, tag: 'QQQ', name: 'Rival2', nameColor: null, trophies: 97022, icon: icon(28000003), clubName: 'Titanes' },
  { rank: 3, tag: 'LLLQ', name: 'SoloPro', nameColor: null, trophies: 96870, icon: icon(28000011), clubName: null },
];

export const RANKED_CLUBS: ClubRanking[] = [
  {
    rank: 1,
    tag: '2YPLQ',
    name: 'Los Cracks',
    trophies: 1020000,
    badgeId: 8000000,
    badgeImageUrl: 'https://cdn.brawlify.com/club-badges/regular/8000000.png',
    memberCount: 30,
  },
  {
    rank: 2,
    tag: '8CGRV',
    name: 'Titanes',
    trophies: 940000,
    badgeId: 8000010,
    badgeImageUrl: 'https://cdn.brawlify.com/club-badges/regular/8000010.png',
    memberCount: 27,
  },
];
```

`apps/web/test/rankings.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeaderboardList } from '@/components/rankings/LeaderboardList';
import { RankBadge } from '@/components/rankings/RankBadge';
import { RankingFilters } from '@/components/rankings/RankingFilters';
import {
  parseRankingType,
  parseRegion,
  rankingSubtitle,
  rankingsHref,
  rankingTabs,
  regionLabel,
  regionOptions,
} from '@/lib/rankings';
import { RANKED_CLUBS, RANKED_PLAYERS } from './fixtures';

describe('lib/rankings', () => {
  it('parsea tipo y región con valores por defecto seguros', () => {
    expect(parseRankingType(undefined)).toBe('jugadores');
    expect(parseRankingType('clubes')).toBe('clubes');
    expect(parseRankingType('hack')).toBe('jugadores');
    expect(parseRegion(undefined)).toBe('global');
    expect(parseRegion('GLOBAL')).toBe('global');
    expect(parseRegion('mx')).toBe('MX');
    expect(parseRegion('zz')).toBe('ZZ');
    expect(parseRegion('mex')).toBe('global');
  });

  it('nombres de región en español; las opciones incluyen la región actual', () => {
    expect(regionLabel('global')).toBe('Global');
    expect(regionLabel('MX')).toBe('México');
    const options = regionOptions('global');
    expect(options[0]).toEqual({ value: 'global', label: 'Global' });
    expect(options).toContainEqual({ value: 'MX', label: 'México' });
    expect(options.some((o) => o.value === 'ZZ')).toBe(false);
    expect(regionOptions('ZZ').some((o) => o.value === 'ZZ')).toBe(true);
    expect(rankingSubtitle('global')).toBe('Top 50 · Global');
    expect(rankingSubtitle('MX', 'Shelly')).toBe('Top 50 · México · Shelly');
  });

  it('rankingsHref y rankingTabs conservan la región y solo llevan brawler en su tipo', () => {
    expect(rankingsHref({ tipo: 'jugadores', region: 'global', brawler: null })).toBe('/rankings?tipo=jugadores');
    expect(rankingsHref({ tipo: 'brawler', region: 'MX', brawler: 16000001 })).toBe(
      '/rankings?tipo=brawler&region=MX&brawler=16000001',
    );
    expect(rankingsHref({ tipo: 'clubes', region: 'ES', brawler: 16000001 })).toBe('/rankings?tipo=clubes&region=ES');
    expect(rankingTabs({ tipo: 'clubes', region: 'MX', brawler: null })).toEqual([
      { href: '/rankings?tipo=jugadores&region=MX', label: 'Jugadores', active: false },
      { href: '/rankings?tipo=clubes&region=MX', label: 'Clubes', active: true },
      { href: '/rankings?tipo=brawler&region=MX', label: 'Por brawler', active: false },
    ]);
  });
});

describe('componentes de rankings', () => {
  it('RankBadge anuncia el puesto en texto', () => {
    const { container } = render(<RankBadge rank={2} />);
    expect(container).toHaveTextContent('Puesto 2');
  });

  it('LeaderboardList de jugadores: link al perfil, club o "Sin club" y trofeos', () => {
    render(<LeaderboardList kind="players" items={RANKED_PLAYERS} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
    expect(within(rows[0]!).getByText('Tribe')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('98,410')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Sin club')).toBeInTheDocument();
  });

  it('LeaderboardList de clubes: link al club y cantidad de miembros', () => {
    render(<LeaderboardList kind="clubs" items={RANKED_CLUBS} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(within(rows[0]!).getByText('30 miembros')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('1,020,000')).toBeInTheDocument();
  });

  it('RankingFilters: GET nativo, región elegida y selector de brawler solo en su tipo', () => {
    const brawlers = [
      { id: 16000002, name: 'BULL' },
      { id: 16000000, name: 'SHELLY' },
    ];
    const { container, unmount } = render(
      <RankingFilters tipo="jugadores" region="MX" brawler={null} brawlers={brawlers} />,
    );
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/rankings');
    expect(container.querySelector('input[type="hidden"][name="tipo"]')).toHaveValue('jugadores');
    expect(screen.getByLabelText('Región')).toHaveValue('MX');
    expect(screen.queryByLabelText('Brawler')).not.toBeInTheDocument();
    unmount();
    render(<RankingFilters tipo="brawler" region="global" brawler={16000002} brawlers={brawlers} />);
    expect(screen.getByLabelText('Brawler')).toHaveValue('16000002');
    expect(screen.getByRole('option', { name: 'Bull' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver ranking' })).toHaveAttribute('type', 'submit');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- rankings`
Expected: FAIL, "Failed to resolve import @/components/rankings/LeaderboardList".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/rankings.ts` (archivo completo):
```ts
import type { TabItem } from '@/components/ui/Tabs';

/** Cuántos puestos se piden por defecto (la API acepta de 1 a 200). */
export const RANKING_LIMIT = 50;

export const RANKING_TYPES = ['jugadores', 'clubes', 'brawler'] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

export function parseRankingType(value: string | undefined): RankingType {
  return (RANKING_TYPES as readonly string[]).includes(value ?? '') ? (value as RankingType) : 'jugadores';
}

/** 'global' o un código de país de 2 letras en mayúsculas; cualquier otra cosa vuelve a 'global'. */
export function parseRegion(value: string | undefined): string {
  if (!value || value.toLowerCase() === 'global') return 'global';
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : 'global';
}

/** Países que se ofrecen en el selector: la comunidad hispanohablante primero, más algunos grandes. */
export const REGIONS = [
  'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'CU', 'PR',
  'ES', 'US', 'BR', 'CA', 'GB', 'FR', 'DE', 'IT', 'PT',
] as const;

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function regionLabel(region: string): string {
  if (region === 'global') return 'Global';
  try {
    return regionNames.of(region) ?? region;
  } catch {
    return region;
  }
}

export interface Option {
  value: string;
  label: string;
}

/** Global primero; el resto por nombre. La región actual se agrega aunque no esté en la lista (ej. ZZ). */
export function regionOptions(current: string): Option[] {
  const codes = new Set<string>(REGIONS);
  if (current !== 'global') codes.add(current);
  const countries = [...codes]
    .map((code) => ({ value: code, label: regionLabel(code) }))
    .sort((x, y) => x.label.localeCompare(y.label, 'es'));
  return [{ value: 'global', label: 'Global' }, ...countries];
}

export interface RankingView {
  tipo: RankingType;
  region: string;
  brawler: number | null;
}

export function rankingsHref({ tipo, region, brawler }: RankingView): string {
  const q = new URLSearchParams({ tipo });
  if (region !== 'global') q.set('region', region);
  if (tipo === 'brawler' && brawler) q.set('brawler', String(brawler));
  return `/rankings?${q.toString()}`;
}

const TAB_LABELS: Record<RankingType, string> = { jugadores: 'Jugadores', clubes: 'Clubes', brawler: 'Por brawler' };

export function rankingTabs(view: RankingView): TabItem[] {
  return RANKING_TYPES.map((tipo) => ({
    href: rankingsHref({ ...view, tipo, brawler: tipo === 'brawler' ? view.brawler : null }),
    label: TAB_LABELS[tipo],
    active: tipo === view.tipo,
  }));
}

export function rankingSubtitle(region: string, brawlerName?: string): string {
  return [`Top ${RANKING_LIMIT}`, regionLabel(region), brawlerName].filter(Boolean).join(' · ');
}
```
Nota: `rankingTabs` le pasa `brawler: null` a las pestañas que no son "Por brawler", así que esos links no llevan `brawler` aunque la vista actual tenga uno. El test espera exactamente eso.

`apps/web/src/components/rankings/RankBadge.tsx`:
```tsx
const PODIUM: Record<number, string> = {
  1: 'bg-[#ffc61a] text-[#14110a]',
  2: 'bg-[#c0c6d0] text-[#14110a]',
  3: 'bg-[#cd7f32] text-[#14110a]',
};

/** El número siempre se lee; el color del podio es un extra, nunca la única señal. */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${PODIUM[rank] ?? 'text-muted'}`}
    >
      <span className="sr-only">Puesto </span>
      {rank}
    </span>
  );
}
```

`apps/web/src/components/rankings/LeaderboardList.tsx`:
```tsx
import type { ClubRanking, PlayerRanking } from '@brawlwiki/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameImage } from '@/components/ui/GameImage';
import { formatNumber } from '@/lib/format';
import { RankBadge } from './RankBadge';

export type LeaderboardProps = { kind: 'players'; items: PlayerRanking[] } | { kind: 'clubs'; items: ClubRanking[] };

const ROW =
  'grid min-h-14 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,12rem)_7rem]';

interface RowProps {
  rank: number;
  image: ReactNode;
  href: string;
  name: string;
  detail: string;
  trophies: number;
}

/** Una sola fila para móvil y escritorio: en móvil el detalle va debajo del nombre; desde md, en su propia columna. */
function Row({ rank, image, href, name, detail, trophies }: RowProps) {
  return (
    <li className={ROW}>
      <span className="col-start-1 row-span-2 row-start-1 md:row-span-1">
        <RankBadge rank={rank} />
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
        {image}
        <Link href={href} className="min-w-0 truncate font-semibold underline underline-offset-2">
          {name}
        </Link>
      </span>
      <span className="col-start-2 row-start-2 truncate text-xs text-muted md:col-start-3 md:row-start-1 md:text-sm">
        {detail}
      </span>
      <span className="col-start-3 row-span-2 row-start-1 text-right font-display tabular-nums md:col-start-4 md:row-span-1">
        {formatNumber(trophies)}
        <span className="sr-only"> trofeos</span>
      </span>
    </li>
  );
}

export function LeaderboardList(props: LeaderboardProps) {
  const players = props.kind === 'players';
  return (
    <div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,12rem)_7rem] gap-x-3 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted md:grid"
      >
        <span>#</span>
        <span>{players ? 'Jugador' : 'Club'}</span>
        <span>{players ? 'Club' : 'Miembros'}</span>
        <span className="text-right">Trofeos</span>
      </div>
      <ol className="divide-y divide-border rounded-card border border-border bg-surface">
        {props.kind === 'players'
          ? props.items.map((p) => (
              <Row
                key={p.tag}
                rank={p.rank}
                href={`/jugador/${p.tag}`}
                name={p.name}
                detail={p.clubName ?? 'Sin club'}
                trophies={p.trophies}
                image={
                  <GameImage
                    src={p.icon.imageUrl}
                    alt={`Ícono de ${p.name}`}
                    size={32}
                    fallbackText={p.name}
                    className="rounded-chip"
                  />
                }
              />
            ))
          : props.items.map((c) => (
              <Row
                key={c.tag}
                rank={c.rank}
                href={`/club/${c.tag}`}
                name={c.name}
                detail={`${c.memberCount} miembros`}
                trophies={c.trophies}
                image={
                  <GameImage
                    src={c.badgeImageUrl}
                    alt={`Escudo de ${c.name}`}
                    size={32}
                    fallbackText={c.name}
                    className="rounded-chip"
                  />
                }
              />
            ))}
      </ol>
    </div>
  );
}
```

`apps/web/src/components/rankings/LeaderboardSkeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export function LeaderboardSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando ranking" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
```

`apps/web/src/components/rankings/RankingFilters.tsx`:
```tsx
import { Button } from '@/components/ui/Button';
import { displayName } from '@/lib/format';
import { type RankingType, regionOptions } from '@/lib/rankings';

interface Props {
  tipo: RankingType;
  region: string;
  brawler: number | null;
  brawlers: { id: number; name: string }[];
}

const FIELD = 'flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted';
const SELECT = 'min-h-11 rounded-card border border-border bg-surface-2 px-3 text-base text-fg';

/** Formulario GET nativo: funciona sin JavaScript y deja los filtros en la URL. */
export function RankingFilters({ tipo, region, brawler, brawlers }: Props) {
  return (
    <form method="get" action="/rankings" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tipo" value={tipo} />
      <label className={FIELD}>
        Región
        <select name="region" defaultValue={region} className={SELECT}>
          {regionOptions(region).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {tipo === 'brawler' && (
        <label className={FIELD}>
          Brawler
          <select name="brawler" defaultValue={brawler ? String(brawler) : ''} className={SELECT}>
            <option value="" disabled>
              Elige un brawler
            </option>
            {brawlers.map((b) => (
              <option key={b.id} value={b.id}>
                {displayName(b.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" variant="secondary">
        Ver ranking
      </Button>
    </form>
  );
}
```
Nota: `getByLabelText('Región')` funciona porque el `<label>` envuelve al `<select>`. El nombre accesible del select es "Región" (el texto del label, sin las opciones).

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (95 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rankings.ts apps/web/src/components/rankings apps/web/test/fixtures.ts apps/web/test/rankings.test.tsx
git commit -m "feat(web): componentes de rankings (regiones en español, podio, tabla responsive y filtros GET)

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 6: Página de rankings (`/rankings`)

**Files:**
- Modify: `apps/web/src/lib/brawlers.ts` (agrega `sortByDisplayName`)
- Create: `apps/web/src/components/rankings/RankingSection.tsx`
- Create: `apps/web/src/app/rankings/page.tsx`, `loading.tsx`
- Test: `apps/web/test/rankings-page.test.tsx`

**Interfaces:**
- Consumes:
  - de la Task 5: `parseRankingType`, `parseRegion`, `rankingTabs`, `rankingSubtitle`, `regionLabel`, `LeaderboardList`, `LeaderboardSkeleton` y `RankingFilters`;
  - de la Task 1: `getPlayerRankings`, `getClubRankings`, `getBrawlerRankings`, `getBrawlers` y `parseBrawlerIdParam`;
  - de los componentes existentes: `Tabs`, `EmptyState`, `ApiErrorView`, `StaleBadge`, `attempt`, `first` y `displayName`.
- Produces:
  - `sortByDisplayName<T extends { name: string }>(list: T[]): T[]`: copia ordenada por `displayName` con `localeCompare('es')`.
  - `RankingSection({ tipo, region, brawler })` (async):
    - `clubes` llama a `getClubRankings(region)`;
    - `brawler`, cuando hay id, llama a `getBrawlerRankings(brawler, region)`;
    - el resto llama a `getPlayerRankings(region)`.
    - Si hay error, muestra `ApiErrorView`. Con `[]`, `EmptyState` "No hay ranking para esta región". Si no, `StaleBadge` y `LeaderboardList`.
  - `/rankings`:
    - `h1` "Rankings" con el subtítulo (`rankingSubtitle`), `Tabs` ("Tipo de ranking") y `RankingFilters`;
    - en el tipo `brawler`, carga la lista de brawlers para el selector. Si falla, muestra `ApiErrorView`; sin brawler elegido, `EmptyState` "Elige un brawler";
    - si no, muestra `<Suspense key=…>` con `RankingSection`.
  - `loading.tsx`: título y `LeaderboardSkeleton`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/rankings-page.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingSection } from '@/components/rankings/RankingSection';
import { ApiError } from '@/lib/api';
import { sortByDisplayName } from '@/lib/brawlers';
import { RANKED_CLUBS } from './fixtures';

const getPlayerRankings = vi.fn();
const getClubRankings = vi.fn();
const getBrawlerRankings = vi.fn();
vi.mock('@/lib/queries', () => ({
  getPlayerRankings: (...a: unknown[]) => getPlayerRankings(...a),
  getClubRankings: (...a: unknown[]) => getClubRankings(...a),
  getBrawlerRankings: (...a: unknown[]) => getBrawlerRankings(...a),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const META = { source: 'fresh' as const, fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 0 };

beforeEach(() => {
  getPlayerRankings.mockReset();
  getClubRankings.mockReset();
  getBrawlerRankings.mockReset();
});

describe('rankings', () => {
  it('sortByDisplayName ordena por el nombre que se muestra, sin mutar', () => {
    const list = [{ name: 'SHELLY' }, { name: 'EL PRIMO' }, { name: '8-BIT' }];
    expect(sortByDisplayName(list).map((b) => b.name)).toEqual(['8-BIT', 'EL PRIMO', 'SHELLY']);
    expect(list[0]!.name).toBe('SHELLY');
  });

  it('región sin datos → estado vacío (Supercell responde 200 con [])', async () => {
    getPlayerRankings.mockResolvedValue({ data: [], meta: META });
    render(await RankingSection({ tipo: 'jugadores', region: 'ZZ', brawler: null }));
    expect(getPlayerRankings).toHaveBeenCalledWith('ZZ');
    expect(screen.getByText('No hay ranking para esta región')).toBeInTheDocument();
  });

  it('clubes y por brawler llaman a su query; un error se muestra en línea', async () => {
    getClubRankings.mockResolvedValue({ data: RANKED_CLUBS, meta: META });
    const { unmount } = render(await RankingSection({ tipo: 'clubes', region: 'global', brawler: null }));
    expect(getClubRankings).toHaveBeenCalledWith('global');
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    unmount();
    getBrawlerRankings.mockRejectedValue(new ApiError('INVALID_PARAM', 'Id de brawler inválido.', { status: 400 }));
    render(await RankingSection({ tipo: 'brawler', region: 'MX', brawler: 16000001 }));
    expect(getBrawlerRankings).toHaveBeenCalledWith(16000001, 'MX');
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los filtros');
  });
});
```
Nota: `RankingSection` es un Server Component async sin hooks. El test lo llama como función (`await RankingSection(props)`) y renderiza el JSX que devuelve, con las queries mockeadas.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- rankings-page`
Expected: FAIL, "Failed to resolve import @/components/rankings/RankingSection".

- [ ] **Step 3: Implementar**

En `apps/web/src/lib/brawlers.ts`:
- agregar `import { displayName } from './format';` debajo del import existente;
- agregar al final:
```ts
/** Copia ordenada por el nombre que ve el usuario ("8-Bit", "El Primo", "Shelly"). */
export function sortByDisplayName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'es'));
}
```

`apps/web/src/components/rankings/RankingSection.tsx`:
```tsx
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBrawlerRankings, getClubRankings, getPlayerRankings } from '@/lib/queries';
import { type RankingView, regionLabel } from '@/lib/rankings';
import { LeaderboardList } from './LeaderboardList';

function NoRanking({ region }: { region: string }) {
  return (
    <EmptyState title="No hay ranking para esta región">
      Supercell no devolvió datos para {regionLabel(region)}. Prueba con otra región o con Global.
    </EmptyState>
  );
}

export async function RankingSection({ tipo, region, brawler }: RankingView) {
  if (tipo === 'clubes') {
    const r = await attempt(getClubRankings(region));
    if (!r.ok) return <ApiErrorView error={r.error} />;
    if (r.value.data.length === 0) return <NoRanking region={region} />;
    return (
      <>
        <StaleBadge meta={r.value.meta} />
        <LeaderboardList kind="clubs" items={r.value.data} />
      </>
    );
  }

  const r = await attempt(
    tipo === 'brawler' && brawler ? getBrawlerRankings(brawler, region) : getPlayerRankings(region),
  );
  if (!r.ok) return <ApiErrorView error={r.error} />;
  if (r.value.data.length === 0) return <NoRanking region={region} />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <LeaderboardList kind="players" items={r.value.data} />
    </>
  );
}
```

`apps/web/src/app/rankings/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { RankingFilters } from '@/components/rankings/RankingFilters';
import { RankingSection } from '@/components/rankings/RankingSection';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { attempt } from '@/lib/attempt';
import { sortByDisplayName } from '@/lib/brawlers';
import { displayName } from '@/lib/format';
import { getBrawlers } from '@/lib/queries';
import { parseRankingType, parseRegion, rankingSubtitle, rankingTabs } from '@/lib/rankings';
import { parseBrawlerIdParam } from '@/lib/route-params';
import { first } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Rankings',
  description: 'Top de jugadores, clubes y brawlers de Brawl Stars, global o por país.',
};

export default async function RankingsPage({ searchParams }: PageProps<'/rankings'>) {
  const sp = await searchParams;
  const tipo = parseRankingType(first(sp.tipo));
  const region = parseRegion(first(sp.region));
  const brawler = tipo === 'brawler' ? parseBrawlerIdParam(first(sp.brawler)) : null;

  const brawlersResult = tipo === 'brawler' ? await attempt(getBrawlers()) : null;
  const brawlers = brawlersResult?.ok ? sortByDisplayName(brawlersResult.value.data) : [];
  const selected = brawlers.find((b) => b.id === brawler);

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Rankings</h1>
      <p className="mt-1 text-sm text-muted">
        {rankingSubtitle(region, selected ? displayName(selected.name) : undefined)}
      </p>
      <Tabs label="Tipo de ranking" items={rankingTabs({ tipo, region, brawler })} />
      <RankingFilters tipo={tipo} region={region} brawler={brawler} brawlers={brawlers} />
      <div className="mt-4">
        {brawlersResult && !brawlersResult.ok ? (
          <ApiErrorView error={brawlersResult.error} />
        ) : tipo === 'brawler' && !brawler ? (
          <EmptyState title="Elige un brawler">Usa el selector para ver los mejores jugadores con ese brawler.</EmptyState>
        ) : (
          <Suspense key={`${tipo}-${region}-${brawler}`} fallback={<LeaderboardSkeleton />}>
            <RankingSection tipo={tipo} region={region} brawler={brawler} />
          </Suspense>
        )}
      </div>
    </>
  );
}
```

`apps/web/src/app/rankings/loading.tsx`:
```tsx
import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="mt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="my-3 h-[52px]" />
      <Skeleton className="mb-4 h-11 w-64" />
      <LeaderboardSkeleton />
    </div>
  );
}
```

- [ ] **Step 4: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (98 tests), typecheck limpio y build OK, con `/rankings` como ruta dinámica.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/brawlers.ts apps/web/src/components/rankings/RankingSection.tsx apps/web/src/app/rankings apps/web/test/rankings-page.test.tsx
git commit -m "feat(web): página de rankings (jugadores, clubes y por brawler) con región y estado vacío

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 7: Componentes del catálogo de brawlers (carta común, filtros y búsqueda)

**Files:**
- Create: `apps/web/src/lib/catalog.ts`
- Create: `apps/web/src/components/brawler/BrawlerCard.tsx`, `CatalogTile.tsx`, `BrawlerFiltersForm.tsx`
- Modify: `apps/web/src/components/brawler/BrawlerTile.tsx` (archivo completo: usa `BrawlerCard` y la rareza en español)
- Modify: `apps/web/test/fixtures.ts` (cambia el import y agrega `catalogBrawler` y `CATALOG` al final), `apps/web/test/player.test.tsx` (el `aria-label` del tile pasa a decir "Raro")
- Test: `apps/web/test/catalog.test.tsx`

**Interfaces:**
- Consumes: `Brawler` y `PlayerBrawler` de shared; `GameImage`, `Button`, `ButtonLink` (`ui`); `displayName`, `formatNumber`; `first` (`lib/search-params`).
- Produces (`lib/catalog.ts`):
  - `rarityLabel(name)`: traduce los nombres de Brawlify. "Starting Brawler" → "Inicial", "Common" → "Común", "Rare" → "Raro", "Super Rare" → "Súper raro", "Epic" → "Épico", "Mythic" → "Mítico", "Legendary" → "Legendario", "Ultra Legendary" → "Ultra legendario". Lo desconocido queda igual.
  - `classLabel(name)`: "Damage Dealer" → "Daño", "Tank" → "Tanque", "Support" → "Apoyo", "Controller" → "Control", "Assassin" → "Asesino", "Marksman" → "Tirador", "Artillery" → "Artillería". Lo desconocido queda igual.
  - `interface BrawlerFilters { q?: string; rareza?: string; clase?: string }`
  - `filterBrawlers(list, filters)`:
    - `q` se busca normalizado (sin acentos, sin importar mayúsculas) dentro del nombre;
    - `rareza` compara exacto con `rarity.name` y `clase` con `class`.
  - `brawlerFacets(list): { rarities: string[]; classes: string[] }`: solo los valores presentes. Las rarezas van en el orden del juego y las clases por nombre en español. **Si no hay metadatos, devuelve dos listas vacías.**
  - `parseBrawlerFilters(searchParams)`: lee `q`, `rareza` y `clase` con `first()` y `trim()`; un string vacío cuenta como `undefined`. La usa la Task 8, pero se define y testea acá.
- Componentes:
  - `BrawlerCard({ name, imageUrl, color, label, href?, children })`: la carta común (spec, sección 5).
    - Arriba va el arte cuadrado sobre `tileBackground(color)`, después la franja de 3px del color de rareza y abajo la barra sólida con `children`. El texto nunca va sobre la imagen.
    - En hover sube 2px (`transition-transform`) y el borde toma el color de rareza (`hover:border-[var(--rarity)]`), como pide el spec.
    - Con `href` es un `Link` con `aria-label`; sin `href` es un `<article aria-label>`.
    - Además, `BrawlerCard.tsx` exporta `NEUTRAL` y `tileBackground(color)`, y `BrawlerTile.tsx` reexporta `tileBackground` para no romper el test existente.
  - `BrawlerTile({ brawler: PlayerBrawler })`: mismo contenido que antes, encima de `BrawlerCard`. El `aria-label` ahora dice la rareza en español ("Bull, 1,000 trofeos, poder 11, Raro").
  - `CatalogTile({ brawler: Brawler })`: link a `/brawlers/ID` con `aria-label` "Nombre[, Rareza]", el nombre y la rareza en español (solo si existe).
  - `BrawlerFiltersForm({ facets, values })`: `<form method="get" action="/brawlers" role="search" aria-label="Filtrar brawlers">` con:
    - un input "Buscar brawler" (`name="q"`);
    - los selects "Rareza" y "Clase", **solo si hay valores**, con la opción "Todas";
    - el botón "Filtrar";
    - el link "Quitar filtros" si hay algún filtro activo.
- `test/fixtures.ts`: `catalogBrawler(overrides?)` y `CATALOG`, los 4 brawlers de los fixtures de la API. Bull lleva además `rarity: Rare` y `class: Tank` para probar los filtros.

- [ ] **Step 1: Ampliar los fixtures, ajustar el test existente y escribir el test que falla**

En `apps/web/test/fixtures.ts`, reemplazar el bloque `import type { … } from '@brawlwiki/shared';` del principio por:
```ts
import type {
  Battle,
  BattlePlayer,
  Brawler,
  Club,
  ClubMember,
  ClubRanking,
  Player,
  PlayerBrawler,
  PlayerRanking,
} from '@brawlwiki/shared';
```
y agregar al final del archivo:
```ts
export function catalogBrawler(overrides: Partial<Brawler> = {}): Brawler {
  return {
    id: 16000000,
    name: 'SHELLY',
    imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000000.png',
    rarity: null,
    class: null,
    gadgets: [],
    starPowers: [],
    ...overrides,
  };
}

/** Los 4 brawlers de los fixtures de la API; Bull trae además metadatos para probar los filtros. */
export const CATALOG: Brawler[] = [
  catalogBrawler({
    id: 16000000,
    name: 'SHELLY',
    gadgets: [{ id: 23000255, name: 'FAST FORWARD' }],
    starPowers: [{ id: 23000076, name: 'SHELL SHOCK' }],
  }),
  catalogBrawler({ id: 16000001, name: 'COLT', imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000001.png' }),
  catalogBrawler({
    id: 16000002,
    name: 'BULL',
    imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000002.png',
    rarity: { name: 'Rare', color: '#68fd58' },
    class: 'Tank',
    gadgets: [{ id: 23000272, name: 'T-BONE INJECTOR' }],
  }),
  catalogBrawler({ id: 16000003, name: 'BROCK', imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000003.png' }),
];
```

En `apps/web/test/player.test.tsx`, cambiar el nombre del article que se busca en el test de `BrawlerTile`:
- antes: `'Bull, 1,000 trofeos, poder 11, Rare'`;
- después: `'Bull, 1,000 trofeos, poder 11, Raro'`.

`apps/web/test/catalog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrawlerFiltersForm } from '@/components/brawler/BrawlerFiltersForm';
import { CatalogTile } from '@/components/brawler/CatalogTile';
import {
  brawlerFacets,
  classLabel,
  filterBrawlers,
  parseBrawlerFilters,
  rarityLabel,
} from '@/lib/catalog';
import { CATALOG, catalogBrawler } from './fixtures';

const names = (list: { name: string }[]) => list.map((b) => b.name);

describe('lib/catalog', () => {
  it('traduce rarezas y clases y deja tal cual lo desconocido', () => {
    expect(rarityLabel('Super Rare')).toBe('Súper raro');
    expect(rarityLabel('Ultra Legendary')).toBe('Ultra legendario');
    expect(rarityLabel('Nueva')).toBe('Nueva');
    expect(classLabel('Tank')).toBe('Tanque');
    expect(classLabel('Rara')).toBe('Rara');
  });

  it('filterBrawlers: búsqueda sin acentos ni mayúsculas, rareza y clase', () => {
    expect(names(filterBrawlers(CATALOG, {}))).toEqual(['SHELLY', 'COLT', 'BULL', 'BROCK']);
    expect(names(filterBrawlers(CATALOG, { q: 'bu' }))).toEqual(['BULL']);
    expect(names(filterBrawlers(CATALOG, { q: '  Shélly ' }))).toEqual(['SHELLY']);
    expect(names(filterBrawlers([catalogBrawler({ name: 'EL PRIMO' })], { q: 'el primo' }))).toEqual(['EL PRIMO']);
    expect(names(filterBrawlers([catalogBrawler({ name: '8-BIT' })], { q: '8-bit' }))).toEqual(['8-BIT']);
    expect(names(filterBrawlers(CATALOG, { rareza: 'Rare' }))).toEqual(['BULL']);
    expect(names(filterBrawlers(CATALOG, { clase: 'Tank', q: 'sh' }))).toEqual([]);
  });

  it('brawlerFacets: solo valores presentes, y nada si no hay metadatos', () => {
    const list = [
      ...CATALOG,
      catalogBrawler({ id: 16000010, name: 'EPICO', rarity: { name: 'Epic', color: '#d850ff' }, class: 'Support' }),
      catalogBrawler({ id: 16000011, name: 'COMUN', rarity: { name: 'Common', color: '#b9eaff' }, class: 'Tank' }),
    ];
    // Las clases van por su nombre en español: "Apoyo" (Support) antes que "Tanque" (Tank).
    expect(brawlerFacets(list)).toEqual({ rarities: ['Common', 'Rare', 'Epic'], classes: ['Support', 'Tank'] });
    expect(brawlerFacets(CATALOG.map((b) => ({ ...b, rarity: null, class: null })))).toEqual({ rarities: [], classes: [] });
  });

  it('parseBrawlerFilters: toma el primer valor, recorta y descarta vacíos', () => {
    expect(parseBrawlerFilters({ q: ['  bu ', 'x'], rareza: '', clase: undefined })).toEqual({ q: 'bu' });
    expect(parseBrawlerFilters({ rareza: 'Rare', clase: 'Tank' })).toEqual({ rareza: 'Rare', clase: 'Tank' });
  });
});

describe('componentes del catálogo', () => {
  it('CatalogTile: link al detalle con nombre y rareza en español', () => {
    render(<CatalogTile brawler={CATALOG[2]!} />);
    const link = screen.getByRole('link', { name: 'Bull, Raro' });
    expect(link).toHaveAttribute('href', '/brawlers/16000002');
    expect(screen.getByText('Bull')).toBeInTheDocument();
    expect(screen.getByText('Raro')).toBeInTheDocument();
  });

  it('BrawlerFiltersForm: sin metadatos solo hay búsqueda; con metadatos aparecen los selects', () => {
    const { container, unmount } = render(
      <BrawlerFiltersForm facets={{ rarities: [], classes: [] }} values={{}} />,
    );
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/brawlers');
    expect(screen.getByLabelText('Buscar brawler')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rareza')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clase')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quitar filtros' })).not.toBeInTheDocument();
    unmount();
    render(<BrawlerFiltersForm facets={{ rarities: ['Rare'], classes: ['Tank'] }} values={{ q: 'bu', rareza: 'Rare' }} />);
    expect(screen.getByLabelText('Buscar brawler')).toHaveValue('bu');
    expect(screen.getByLabelText('Rareza')).toHaveValue('Rare');
    expect(screen.getByRole('option', { name: 'Raro' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tanque' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quitar filtros' })).toHaveAttribute('href', '/brawlers');
  });
});
```
- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- catalog player`
Expected: FAIL. `catalog.test.tsx` da "Failed to resolve import @/lib/catalog" y el test de `BrawlerTile` no encuentra el article con "Raro".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/catalog.ts`:
```ts
import type { Brawler } from '@brawlwiki/shared';
import { first } from './search-params';

const RARITY_ORDER = [
  'Starting Brawler',
  'Common',
  'Rare',
  'Super Rare',
  'Epic',
  'Mythic',
  'Legendary',
  'Ultra Legendary',
];

const RARITY_LABELS: Record<string, string> = {
  'Starting Brawler': 'Inicial',
  Common: 'Común',
  Rare: 'Raro',
  'Super Rare': 'Súper raro',
  Epic: 'Épico',
  Mythic: 'Mítico',
  Legendary: 'Legendario',
  'Ultra Legendary': 'Ultra legendario',
};

const CLASS_LABELS: Record<string, string> = {
  'Damage Dealer': 'Daño',
  Tank: 'Tanque',
  Support: 'Apoyo',
  Controller: 'Control',
  Assassin: 'Asesino',
  Marksman: 'Tirador',
  Artillery: 'Artillería',
};

export function rarityLabel(name: string): string {
  return RARITY_LABELS[name] ?? name;
}

export function classLabel(name: string): string {
  return CLASS_LABELS[name] ?? name;
}

export interface BrawlerFilters {
  q?: string;
  rareza?: string;
  clase?: string;
}

/** Minúsculas y sin acentos: "Shélly" encuentra a "SHELLY". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filterBrawlers(list: Brawler[], f: BrawlerFilters): Brawler[] {
  const q = f.q ? fold(f.q.trim()) : '';
  return list.filter(
    (b) =>
      (!f.rareza || b.rarity?.name === f.rareza) &&
      (!f.clase || b.class === f.clase) &&
      (!q || fold(b.name).includes(q)),
  );
}

export interface Facets {
  rarities: string[];
  classes: string[];
}

const rarityRank = (name: string) => {
  const i = RARITY_ORDER.indexOf(name);
  return i === -1 ? RARITY_ORDER.length : i;
};

/** Solo los valores que existen en la lista; vacío si la API todavía no tiene metadatos. */
export function brawlerFacets(list: Brawler[]): Facets {
  const rarities = [...new Set(list.flatMap((b) => (b.rarity ? [b.rarity.name] : [])))].sort(
    (a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b),
  );
  const classes = [...new Set(list.flatMap((b) => (b.class ? [b.class] : [])))].sort((a, b) =>
    classLabel(a).localeCompare(classLabel(b), 'es'),
  );
  return { rarities, classes };
}

export function parseBrawlerFilters(sp: Record<string, string | string[] | undefined>): BrawlerFilters {
  const read = (key: string) => first(sp[key])?.trim() || undefined;
  const out: BrawlerFilters = {};
  const q = read('q');
  const rareza = read('rareza');
  const clase = read('clase');
  if (q) out.q = q;
  if (rareza) out.rareza = rareza;
  if (clase) out.clase = clase;
  return out;
}
```

`apps/web/src/components/brawler/BrawlerCard.tsx`:
```tsx
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { GameImage } from '@/components/ui/GameImage';

export const NEUTRAL = '#3a3a4a';

/** Arte sobre un fondo radial del color de rareza; la base oscura se mantiene en ambos temas, como una carta del juego. */
export function tileBackground(color: string | null): string {
  const c = color ?? NEUTRAL;
  return `radial-gradient(circle at 50% 35%, ${c} 0%, color-mix(in srgb, ${c} 30%, #0b0b0f) 75%)`;
}

interface BrawlerCardProps {
  name: string;
  imageUrl: string | null;
  color: string | null;
  label: string;
  href?: string;
  children: ReactNode;
}

const CARD =
  'block overflow-hidden rounded-card border border-border bg-surface transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--rarity)]';

/** Carta de brawler: el texto va siempre en la barra sólida de abajo, nunca sobre la imagen (spec, sección 5). */
export function BrawlerCard({ name, imageUrl, color, label, href, children }: BrawlerCardProps) {
  const style = { '--rarity': color ?? NEUTRAL } as CSSProperties;
  const body = (
    <>
      <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
        <GameImage src={imageUrl} alt={name} size={96} fallbackText={name} className="h-[85%] w-auto object-contain" />
      </div>
      <div aria-hidden="true" className="h-[3px] bg-[var(--rarity)]" />
      <div className="space-y-1 px-2 py-1">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} className={CARD} style={style}>
      {body}
    </Link>
  ) : (
    <article aria-label={label} className={CARD} style={style}>
      {body}
    </article>
  );
}
```

`apps/web/src/components/brawler/BrawlerTile.tsx` (archivo completo):
```tsx
import type { PlayerBrawler } from '@brawlwiki/shared';
import { rarityLabel } from '@/lib/catalog';
import { displayName, formatNumber } from '@/lib/format';
import { BrawlerCard } from './BrawlerCard';

export { tileBackground } from './BrawlerCard';

export function BrawlerTile({ brawler }: { brawler: PlayerBrawler }) {
  const name = displayName(brawler.name);
  const label = [
    name,
    `${formatNumber(brawler.trophies)} trofeos`,
    `poder ${brawler.power}`,
    brawler.rarity ? rarityLabel(brawler.rarity.name) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <BrawlerCard name={name} imageUrl={brawler.imageUrl} color={brawler.rarity?.color ?? null} label={label}>
      <span className="block truncate text-xs font-bold">{name}</span>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-muted">{formatNumber(brawler.trophies)}</span>
        <span className="text-[10px] font-bold tabular-nums">P{brawler.power}</span>
      </div>
    </BrawlerCard>
  );
}
```

`apps/web/src/components/brawler/CatalogTile.tsx`:
```tsx
import type { Brawler } from '@brawlwiki/shared';
import { rarityLabel } from '@/lib/catalog';
import { displayName } from '@/lib/format';
import { BrawlerCard } from './BrawlerCard';

export function CatalogTile({ brawler }: { brawler: Brawler }) {
  const name = displayName(brawler.name);
  const rarity = brawler.rarity ? rarityLabel(brawler.rarity.name) : null;
  return (
    <BrawlerCard
      name={name}
      imageUrl={brawler.imageUrl}
      color={brawler.rarity?.color ?? null}
      label={[name, rarity].filter(Boolean).join(', ')}
      href={`/brawlers/${brawler.id}`}
    >
      <span className="block truncate text-xs font-bold">{name}</span>
      {rarity && <span className="block truncate text-[10px] text-muted">{rarity}</span>}
    </BrawlerCard>
  );
}
```

`apps/web/src/components/brawler/BrawlerFiltersForm.tsx`:
```tsx
import { Button, ButtonLink } from '@/components/ui/Button';
import { type BrawlerFilters, classLabel, type Facets, rarityLabel } from '@/lib/catalog';

const FIELD = 'flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted';
const CONTROL = 'min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base text-fg';

/** Formulario GET nativo: los filtros quedan en la URL y funciona sin JavaScript. */
export function BrawlerFiltersForm({ facets, values }: { facets: Facets; values: BrawlerFilters }) {
  const active = Boolean(values.q || values.rareza || values.clase);
  return (
    <form
      method="get"
      action="/brawlers"
      role="search"
      aria-label="Filtrar brawlers"
      className="flex flex-wrap items-end gap-2"
    >
      <label className={`${FIELD} grow basis-48`}>
        Buscar brawler
        <input
          name="q"
          defaultValue={values.q ?? ''}
          placeholder="Ej. Shelly"
          autoComplete="off"
          className={`${CONTROL} placeholder:text-muted`}
        />
      </label>
      {facets.rarities.length > 0 && (
        <label className={FIELD}>
          Rareza
          <select name="rareza" defaultValue={values.rareza ?? ''} className={CONTROL}>
            <option value="">Todas</option>
            {facets.rarities.map((r) => (
              <option key={r} value={r}>
                {rarityLabel(r)}
              </option>
            ))}
          </select>
        </label>
      )}
      {facets.classes.length > 0 && (
        <label className={FIELD}>
          Clase
          <select name="clase" defaultValue={values.clase ?? ''} className={CONTROL}>
            <option value="">Todas</option>
            {facets.classes.map((c) => (
              <option key={c} value={c}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
      {active && (
        <ButtonLink href="/brawlers" variant="ghost">
          Quitar filtros
        </ButtonLink>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (104 tests acumulados: 98 + 6), typecheck limpio. El test de `BrawlerTile` en `player.test.tsx` pasa con "Raro", y `BrawlerGrid` y `PlayerOverview` siguen encontrando `article`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/catalog.ts apps/web/src/components/brawler apps/web/test/fixtures.ts apps/web/test/player.test.tsx apps/web/test/catalog.test.tsx
git commit -m "feat(web): carta de brawler común, tile de catálogo y filtros GET con búsqueda sin acentos

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 8: Página del catálogo (`/brawlers`)

**Files:**
- Create: `apps/web/src/app/brawlers/page.tsx`, `loading.tsx`

**Interfaces:**
- Consumes: `getBrawlers` (Task 1); `sortByDisplayName` (Task 6); `parseBrawlerFilters`, `filterBrawlers`, `brawlerFacets`, `CatalogTile`, `BrawlerFiltersForm` (Task 7); `ApiErrorView`, `StaleBadge`, `EmptyState`, `Skeleton`; `attempt`.
- Produces:
  - `/brawlers`: `h1` "Brawlers", `StaleBadge` y `BrawlerFiltersForm`.
    - Si no hay ningún valor de rareza ni de clase, muestra la nota "La rareza y la clase todavía no están disponibles.".
    - Un contador `role="status"` dice "Mostrando N de M brawlers".
    - La grilla de `CatalogTile` va en 4, 5, 6 u 8 columnas, igual que `BrawlerGrid`. Si ningún brawler coincide, muestra `EmptyState` "Ningún brawler coincide" con un link para quitar los filtros.
    - Si la API falla, muestra el `h1` y `ApiErrorView`.
  - `metadata`: título "Brawlers" y una descripción.
  - `loading.tsx`: `role="status"`, `aria-label="Cargando brawlers"`, con título, filtros y grilla.

Esta tarea no tiene test unitario nuevo: `parseBrawlerFilters`, `filterBrawlers` y `brawlerFacets` ya se testean en la Task 7, y la página la cubre el E2E de la Task 11.

- [ ] **Step 1: Implementar**

`apps/web/src/app/brawlers/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrawlerFiltersForm } from '@/components/brawler/BrawlerFiltersForm';
import { CatalogTile } from '@/components/brawler/CatalogTile';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { sortByDisplayName } from '@/lib/brawlers';
import { brawlerFacets, filterBrawlers, parseBrawlerFilters } from '@/lib/catalog';
import { getBrawlers } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Brawlers',
  description: 'Catálogo de brawlers de Brawl Stars con rareza, clase, gadgets y habilidades estelares.',
};

export default async function BrawlersPage({ searchParams }: PageProps<'/brawlers'>) {
  const values = parseBrawlerFilters(await searchParams);
  const r = await attempt(getBrawlers());
  if (!r.ok) {
    return (
      <>
        <h1 className="mt-6 font-display text-3xl">Brawlers</h1>
        <ApiErrorView error={r.error} />
      </>
    );
  }

  const all = sortByDisplayName(r.value.data);
  const facets = brawlerFacets(all);
  const shown = filterBrawlers(all, values);
  const noMetadata = facets.rarities.length === 0 && facets.classes.length === 0;

  return (
    <>
      <h1 className="mt-6 font-display text-3xl">Brawlers</h1>
      <StaleBadge meta={r.value.meta} />
      <div className="mt-3">
        <BrawlerFiltersForm facets={facets} values={values} />
      </div>
      {noMetadata && <p className="mt-2 text-xs text-muted">La rareza y la clase todavía no están disponibles.</p>}
      <p role="status" className="mt-3 text-sm text-muted">
        Mostrando {shown.length} de {all.length} brawlers
      </p>
      {shown.length === 0 ? (
        <EmptyState title="Ningún brawler coincide">
          Prueba con otro nombre o{' '}
          <Link href="/brawlers" className="underline underline-offset-2">
            quita los filtros
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {shown.map((b) => (
            <li key={b.id}>
              <CatalogTile brawler={b} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

`apps/web/src/app/brawlers/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando brawlers" className="mt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-3 h-11" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (104 tests, sin cambios), typecheck limpio y build OK, con `/brawlers` como ruta dinámica.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/brawlers
git commit -m "feat(web): catálogo de brawlers con búsqueda y filtros en la URL

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 9: Detalle de brawler (`/brawlers/[id]`)

**Files:**
- Create: `apps/web/src/components/brawler/BrawlerDetail.tsx`, `BrawlerTopPlayers.tsx`
- Create: `apps/web/src/app/brawlers/[id]/page.tsx`, `loading.tsx`, `not-found.tsx`
- Test: `apps/web/test/brawler-detail.test.tsx`

**Interfaces:**
- Consumes: `getBrawler`, `getBrawlerRankings`, `parseBrawlerIdParam` (Task 1); `rankingsHref` (Task 5); `LeaderboardList`, `LeaderboardSkeleton` (Task 5); `NEUTRAL`, `tileBackground`, `rarityLabel`, `classLabel` (Task 7); `GameImage`, `ButtonLink`, `Skeleton`; `ApiErrorView`, `StaleBadge`, `EmptyState`; `attempt`; `displayName`.
- Produces:
  - `BrawlerDetail({ brawler: Brawler })`: `<article aria-labelledby="brawler-name">` con:
    - el arte grande (192px) sobre `tileBackground` y una franja de rareza;
    - `h1` con el nombre;
    - un `<dl>` con Rareza y Clase en español (o "Sin dato");
    - dos secciones (`h2` "Gadgets" y "Habilidades estelares") con la lista de nombres (`displayName`). Si una está vacía, dice "Todavía no tiene gadgets." o "Todavía no tiene habilidades estelares.".
  - `TOP_PLAYERS = 10`
  - `BrawlerTopPlayers({ id })` (async): llama a `getBrawlerRankings(id, 'global', TOP_PLAYERS)`.
    - Si falla, muestra `ApiErrorView`.
    - Con `[]`, muestra `EmptyState` "Todavía no hay ranking para este brawler".
    - Si no, muestra `StaleBadge` y `LeaderboardList kind="players"`.
  - `/brawlers/[id]`:
    - un id inválido llama a `notFound()`;
    - precarga el ranking (`void getBrawlerRankings(id, 'global', TOP_PLAYERS).catch(() => {})`, con los mismos argumentos que `BrawlerTopPlayers`);
    - `NOT_FOUND` o `INVALID_PARAM` llaman a `notFound()` y cualquier otro error muestra `ApiErrorView`;
    - con datos: link "Todos los brawlers", `StaleBadge`, `BrawlerDetail` y la sección "Mejores jugadores" con el link "Ver ranking completo" (`/rankings?tipo=brawler&brawler=ID`) y `<Suspense>` con `BrawlerTopPlayers`.
  - `generateMetadata`: el título es el nombre en formato título, con una descripción; si hay error, "Brawler".
  - `not-found.tsx`: `h1` "No encontramos ese brawler" + `ButtonLink` "Ver todos los brawlers".
  - `loading.tsx`: `role="status"`, `aria-label="Cargando brawler"`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/brawler-detail.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrawlerNotFound from '@/app/brawlers/[id]/not-found';
import { BrawlerDetail } from '@/components/brawler/BrawlerDetail';
import { CATALOG } from './fixtures';

describe('detalle de brawler', () => {
  it('sin metadatos: "Sin dato", gadgets y habilidades estelares en formato título', () => {
    render(<BrawlerDetail brawler={CATALOG[0]!} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Shelly' })).toBeInTheDocument();
    expect(screen.getAllByText('Sin dato')).toHaveLength(2);
    const gadgets = screen.getByRole('region', { name: 'Gadgets' });
    expect(within(gadgets).getByText('Fast Forward')).toBeInTheDocument();
    const stars = screen.getByRole('region', { name: 'Habilidades estelares' });
    expect(within(stars).getByText('Shell Shock')).toBeInTheDocument();
  });

  it('con metadatos: rareza y clase en español; lista vacía explicada', () => {
    render(<BrawlerDetail brawler={CATALOG[2]!} />);
    expect(screen.getByText('Raro')).toBeInTheDocument();
    expect(screen.getByText('Tanque')).toBeInTheDocument();
    expect(screen.getByText('T-Bone Injector')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tiene habilidades estelares.')).toBeInTheDocument();
  });

  it('404 del brawler con link al catálogo', () => {
    render(<BrawlerNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos los brawlers' })).toHaveAttribute('href', '/brawlers');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- brawler-detail`
Expected: FAIL, "Failed to resolve import @/app/brawlers/[id]/not-found".

- [ ] **Step 3: Implementar**

`apps/web/src/components/brawler/BrawlerDetail.tsx`:
```tsx
import type { Brawler, NamedItem } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { classLabel, rarityLabel } from '@/lib/catalog';
import { displayName } from '@/lib/format';
import { NEUTRAL, tileBackground } from './BrawlerCard';

function ItemList({ id, title, items, empty }: { id: string; title: string; items: NamedItem[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <h2 id={id} className="mb-2 font-display text-lg">
        {title}
      </h2>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="rounded-chip bg-surface-2 px-3 py-2 text-sm">
              {displayName(item.name)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

export function BrawlerDetail({ brawler }: { brawler: Brawler }) {
  const name = displayName(brawler.name);
  const color = brawler.rarity?.color ?? null;
  return (
    <article aria-labelledby="brawler-name" className="mt-2 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
      <div className="overflow-hidden rounded-card border border-border">
        <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
          <GameImage src={brawler.imageUrl} alt={name} size={192} fallbackText={name} className="h-[85%] w-auto object-contain" />
        </div>
        <div aria-hidden="true" className="h-1" style={{ background: color ?? NEUTRAL }} />
      </div>
      <div className="min-w-0">
        <h1 id="brawler-name" className="truncate font-display text-3xl">
          {name}
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1">
            <dt className="text-muted">Rareza:</dt>
            <dd className="font-semibold">{brawler.rarity ? rarityLabel(brawler.rarity.name) : 'Sin dato'}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Clase:</dt>
            <dd className="font-semibold">{brawler.class ? classLabel(brawler.class) : 'Sin dato'}</dd>
          </div>
        </dl>
        <ItemList id="gadgets-title" title="Gadgets" items={brawler.gadgets} empty="Todavía no tiene gadgets." />
        <ItemList
          id="star-powers-title"
          title="Habilidades estelares"
          items={brawler.starPowers}
          empty="Todavía no tiene habilidades estelares."
        />
      </div>
    </article>
  );
}
```
Nota: el test busca las secciones con `getByRole('region', { name })`. Un `<section>` con `aria-labelledby` tiene rol `region`.

`apps/web/src/components/brawler/BrawlerTopPlayers.tsx`:
```tsx
import { LeaderboardList } from '@/components/rankings/LeaderboardList';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBrawlerRankings } from '@/lib/queries';

export const TOP_PLAYERS = 10;

export async function BrawlerTopPlayers({ id }: { id: number }) {
  const r = await attempt(getBrawlerRankings(id, 'global', TOP_PLAYERS));
  if (!r.ok) return <ApiErrorView error={r.error} />;
  if (r.value.data.length === 0) return <EmptyState title="Todavía no hay ranking para este brawler" />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <LeaderboardList kind="players" items={r.value.data} />
    </>
  );
}
```

`apps/web/src/app/brawlers/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BrawlerDetail } from '@/components/brawler/BrawlerDetail';
import { BrawlerTopPlayers, TOP_PLAYERS } from '@/components/brawler/BrawlerTopPlayers';
import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { displayName } from '@/lib/format';
import { getBrawler, getBrawlerRankings } from '@/lib/queries';
import { rankingsHref } from '@/lib/rankings';
import { parseBrawlerIdParam } from '@/lib/route-params';

export async function generateMetadata({ params }: PageProps<'/brawlers/[id]'>): Promise<Metadata> {
  const id = parseBrawlerIdParam((await params).id);
  if (!id) return { title: 'Brawler' };
  const r = await attempt(getBrawler(id));
  if (!r.ok) return { title: 'Brawler' };
  const name = displayName(r.value.data.name);
  return {
    title: name,
    description: `${name} en Brawl Stars: rareza, clase, gadgets, habilidades estelares y los mejores jugadores.`,
  };
}

export default async function BrawlerPage({ params }: PageProps<'/brawlers/[id]'>) {
  const id = parseBrawlerIdParam((await params).id);
  if (!id) notFound();

  // Precarga el ranking en paralelo; `cache()` le entrega la misma promesa a BrawlerTopPlayers.
  void getBrawlerRankings(id, 'global', TOP_PLAYERS).catch(() => {});

  const r = await attempt(getBrawler(id));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND' || r.error.code === 'INVALID_PARAM') notFound();
    return <ApiErrorView error={r.error} />;
  }

  return (
    <>
      <Link href="/brawlers" className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←&nbsp;</span>Todos los brawlers
      </Link>
      <StaleBadge meta={r.value.meta} />
      <BrawlerDetail brawler={r.value.data} />
      <section aria-labelledby="top-title" className="mt-8">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-title" className="font-display text-lg">
            Mejores jugadores
          </h2>
          <Link
            href={rankingsHref({ tipo: 'brawler', region: 'global', brawler: id })}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-2"
          >
            Ver ranking completo
          </Link>
        </div>
        <Suspense fallback={<LeaderboardSkeleton rows={5} />}>
          <BrawlerTopPlayers id={id} />
        </Suspense>
      </section>
    </>
  );
}
```

`apps/web/src/app/brawlers/[id]/not-found.tsx`:
```tsx
import { ButtonLink } from '@/components/ui/Button';

export default function BrawlerNotFound() {
  return (
    <div className="mx-auto my-12 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese brawler</h1>
      <p className="mt-2 text-sm text-muted">Puede que el link esté mal o que el brawler todavía no exista.</p>
      <ButtonLink href="/brawlers" className="mt-6">
        Ver todos los brawlers
      </ButtonLink>
    </div>
  );
}
```

`apps/web/src/app/brawlers/[id]/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando brawler" className="mt-4">
      <Skeleton className="h-11 w-40" />
      <div className="mt-2 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (107 tests), typecheck limpio y build OK, con `/brawlers/[id]` como ruta dinámica.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/brawler/BrawlerDetail.tsx apps/web/src/components/brawler/BrawlerTopPlayers.tsx apps/web/src/app/brawlers apps/web/test/brawler-detail.test.tsx
git commit -m "feat(web): detalle de brawler con gadgets, habilidades estelares y mejores jugadores

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 10: Página "Acerca de" (`/acerca`) + link en el footer

**Files:**
- Create: `apps/web/src/app/acerca/page.tsx`
- Modify: `apps/web/src/components/layout/Footer.tsx` (archivo completo)
- Test: `apps/web/test/about.test.tsx`

**Interfaces:**
- Consumes: `Disclaimer`, `DISCLAIMER` (`ui/Disclaimer`).
- Produces:
  - `/acerca` (estática), con:
    - `h1` "Acerca de BrawlWiki";
    - tres secciones (`h2`): "De dónde salen los datos", "Tus datos" y "Aviso legal";
    - el `Disclaimer` y el link "Fan Content Policy de Supercell" a `https://supercell.com/en/fan-content-policy/`, que abre en la misma pestaña, subrayado.
  - `metadata`: título "Acerca de" y una descripción.
  - `Footer`: el contenido de antes y un link "Acerca de BrawlWiki" (`/acerca`) de al menos 44px de alto.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/about.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from '@/app/acerca/page';
import { Footer } from '@/components/layout/Footer';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

describe('Acerca de', () => {
  it('explica los datos, la privacidad y el aviso legal con la Fan Content Policy', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acerca de BrawlWiki' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'De dónde salen los datos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aviso legal' })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fan Content Policy de Supercell' })).toHaveAttribute(
      'href',
      'https://supercell.com/en/fan-content-policy/',
    );
  });

  it('el footer enlaza a la página Acerca de', () => {
    render(<Footer />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acerca de BrawlWiki' })).toHaveAttribute('href', '/acerca');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- about`
Expected: FAIL, "Failed to resolve import @/app/acerca/page".

- [ ] **Step 3: Implementar**

`apps/web/src/app/acerca/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Disclaimer } from '@/components/ui/Disclaimer';

export const metadata: Metadata = {
  title: 'Acerca de',
  description: 'Qué es BrawlWiki, de dónde salen sus datos y el aviso legal de esta fan page no oficial.',
};

const H2 = 'mt-8 mb-2 font-display text-lg';
const P = 'text-sm leading-relaxed text-muted';

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mt-6 font-display text-3xl">Acerca de BrawlWiki</h1>
      <p className={`mt-3 ${P}`}>
        BrawlWiki es una fan page hecha por la comunidad para consultar perfiles, clubes, rankings y brawlers de Brawl
        Stars desde el celular, entre partida y partida.
      </p>

      <h2 className={H2}>De dónde salen los datos</h2>
      <p className={P}>
        Los datos vienen de la API oficial de Brawl Stars de Supercell. BrawlWiki guarda una copia por unos minutos para
        responder rápido. Si Supercell no responde, verás el último dato guardado con un aviso de cuánto tiempo tiene.
        Las imágenes de brawlers, mapas e íconos vienen del CDN de Brawlify.
      </p>

      <h2 className={H2}>Tus datos</h2>
      <p className={P}>
        No hay cuentas. Tus favoritos y tus búsquedas recientes se guardan solo en este navegador y puedes borrarlos
        limpiando los datos del sitio.
      </p>

      <h2 className={H2}>Aviso legal</h2>
      <Disclaimer className="text-sm" />
      <p className={`mt-2 ${P}`}>
        BrawlWiki sigue la{' '}
        <a
          href="https://supercell.com/en/fan-content-policy/"
          className="text-fg underline underline-offset-2"
        >
          Fan Content Policy de Supercell
        </a>
        .
      </p>
    </article>
  );
}
```

`apps/web/src/components/layout/Footer.tsx` (archivo completo):
```tsx
import Link from 'next/link';
import { Disclaimer } from '@/components/ui/Disclaimer';

export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 text-center md:px-6 md:pb-10">
      <Disclaimer />
      <p className="mt-1 text-xs text-muted">Fan page hecha por la comunidad. Datos vía la API oficial de Brawl Stars.</p>
      <Link href="/acerca" className="inline-flex min-h-11 items-center text-xs text-muted underline underline-offset-2">
        Acerca de BrawlWiki
      </Link>
    </footer>
  );
}
```

- [ ] **Step 4: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (109 tests), typecheck limpio y build OK, con `/acerca` como ruta estática (○). El test existente de `Header` y `Footer` en `layout.test.tsx` sigue pasando.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/acerca apps/web/src/components/layout/Footer.tsx apps/web/test/about.test.tsx
git commit -m "feat(web): página Acerca de con origen de datos, privacidad y aviso legal; link en el footer

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 11: E2E de las secciones nuevas, medición con Lighthouse y README

**Files:**
- Create: `apps/web/e2e/clubs.spec.ts`, `compare.spec.ts`, `rankings.spec.ts`, `brawlers.spec.ts`, `about.spec.ts` (en `apps/web/e2e/`)
- Modify: `apps/web/e2e/theme.spec.ts` (agrega un test al final)
- Modify: `README.md` (reemplaza la sección "## Comandos" completa y agrega "## Rendimiento")

**Interfaces:**
- Consumes: todas las páginas de las Tasks 1 a 10; `test`, `expect`, `gotoReady`, `expectAccessible` y `expectNoHorizontalScroll` de `e2e/fixtures.ts`; los datos de los fixtures listados en Global Constraints.
- Produces:
  - 22 tests E2E nuevos, todos en el proyecto `main`: clubes 6, comparador 4, rankings 5, brawlers 5, acerca 1 y tema claro 1. En total quedan 39.
  - Una tabla de rendimiento en el README con las mediciones reales de Lighthouse.
  - El README arreglado: hoy la nota sobre `.next` quedó en medio de la tabla de comandos y corta la fila de `meta:import`.

- [ ] **Step 1: Escribir los specs**

`apps/web/e2e/clubs.spec.ts`:
```ts
import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('perfil → club: header, miembros y link a cada jugador', async ({ page }) => {
  await page.goto('/jugador/2PP');
  await page.getByRole('main').getByRole('link', { name: 'Los Cracks' }).click();
  await expect(page).toHaveURL('/club/2YPLQ');
  await expect(page.getByRole('heading', { level: 1, name: 'Los Cracks' })).toBeVisible();
  await expect(page.getByText('#2YPLQ · Solo por invitación')).toBeVisible();
  const members = page.getByRole('region', { name: /Miembros/ });
  await expect(members.getByRole('listitem')).toHaveCount(3);
  await expect(members.getByRole('link', { name: 'EzyPlayer' })).toHaveAttribute('href', '/jugador/2PP');
  await expect(members.getByRole('listitem').first()).toContainText('Presidente');
  await expectAccessible(page);
});

test('un club favorito y visitado aparece en Favoritos y en Recientes del inicio', async ({ page }) => {
  await gotoReady(page, '/club/2YPLQ');
  await page.getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'FAVORITOS' }).getByRole('link', { name: /Los Cracks/ })).toHaveAttribute(
    'href',
    '/club/2YPLQ',
  );
  await expect(page.getByRole('region', { name: 'RECIENTES' }).getByRole('link', { name: /Los Cracks/ })).toHaveAttribute(
    'href',
    '/club/2YPLQ',
  );
});

test('club: tag no canónico redirige, inexistente da 404 e inválido da tag inválido', async ({ page }) => {
  await page.goto('/club/2yplq');
  await expect(page).toHaveURL('/club/2YPLQ');
  await page.goto('/club/9Q9Q');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese club' })).toBeVisible();
  await page.goto('/club/HOLA');
  await expect(page.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Tag del club')).toBeVisible();
});

test('#LLLL en un club → aviso de mantenimiento', async ({ page }) => {
  await page.goto('/club/LLLL');
  await expect(page.getByRole('heading', { name: 'Brawl Stars está en mantenimiento' })).toBeVisible();
});

test('a 375px el club no tiene scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/club/2YPLQ');
  await expect(page.getByRole('heading', { level: 1, name: 'Los Cracks' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('la imagen OG del club responde un PNG', async ({ page, request }) => {
  await page.goto('/club/2YPLQ');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
  const res = await request.get(og!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});
```

`apps/web/e2e/compare.spec.ts`:
```ts
import { expect, expectAccessible, test } from './fixtures';

test('desde la navegación inferior: comparar dos clubes con el formulario', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegación inferior' }).getByRole('link', { name: /Clubes/ }).click();
  await expect(page).toHaveURL('/clubes/comparar');
  await expect(page.getByRole('heading', { level: 1, name: 'Clubes' })).toBeVisible();
  await page.getByLabel('Club A').fill('2yplq');
  await page.getByLabel('Club B').fill('#8CGRV');
  await page.getByRole('button', { name: 'Comparar' }).click();
  await expect(page).toHaveURL('/clubes/comparar?a=2yplq&b=%238CGRV');
  const cards = page.getByRole('main').getByRole('listitem');
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText('Trofeos totales');
  await expect(cards.first()).toContainText('1,020,000');
  await expect(cards.first()).toContainText('940,000');
  await expect(cards.first()).toContainText('Mayor');
  await expectAccessible(page);
});

test('errores en línea: tag inválido y el mismo club dos veces', async ({ page }) => {
  await page.goto('/clubes/comparar?a=hola&b=8CGRV');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('0289PYLQGRJCUV');
  await expect(page.getByLabel('Club A')).toHaveAttribute('aria-invalid', 'true');
  await page.goto('/clubes/comparar?a=2YPLQ&b=2yplq');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Elige un club distinto');
  await expectAccessible(page);
});

test('un club que no existe se informa de su lado sin romper la página', async ({ page }) => {
  await page.goto('/clubes/comparar?a=2YPLQ&b=9Q9Q');
  await expect(page.getByText('No encontramos el club #9Q9Q')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Clubes' })).toBeVisible();
});

test('"Comparar con otro club" llega con el Club A completo', async ({ page }) => {
  await page.goto('/club/2YPLQ');
  await page.getByRole('link', { name: 'Comparar con otro club' }).click();
  await expect(page).toHaveURL('/clubes/comparar?a=2YPLQ');
  await expect(page.getByLabel('Club A')).toHaveValue('2YPLQ');
});
```

`apps/web/e2e/rankings.spec.ts`:
```ts
import { expect, expectAccessible, expectNoHorizontalScroll, test } from './fixtures';

test('ranking global de jugadores con podio en texto y links al perfil', async ({ page }) => {
  await page.goto('/rankings');
  await expect(page.getByRole('heading', { level: 1, name: 'Rankings' })).toBeVisible();
  await expect(page.getByText('Top 50 · Global')).toBeVisible();
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Puesto 1');
  await expect(rows.first().getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
  await expect(rows.nth(2)).toContainText('Sin club');
  await expectAccessible(page);
});

test('cambiar la región con el formulario la deja en la URL', async ({ page }) => {
  await page.goto('/rankings');
  await page.getByLabel('Región').selectOption('MX');
  await page.getByRole('button', { name: 'Ver ranking' }).click();
  await expect(page).toHaveURL('/rankings?tipo=jugadores&region=MX');
  await expect(page.getByText('Top 50 · México')).toBeVisible();
  await expect(page.getByLabel('Región')).toHaveValue('MX');
});

test('la pestaña Clubes conserva la región', async ({ page }) => {
  await page.goto('/rankings?tipo=jugadores&region=MX');
  await page.getByRole('navigation', { name: 'Tipo de ranking' }).getByRole('link', { name: 'Clubes' }).click();
  await expect(page).toHaveURL('/rankings?tipo=clubes&region=MX');
  const first = page.getByRole('main').getByRole('listitem').first();
  await expect(first.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
  await expect(first).toContainText('30 miembros');
  await expectAccessible(page);
});

test('por brawler: primero pide elegir y después muestra el ranking', async ({ page }) => {
  await page.goto('/rankings?tipo=brawler');
  await expect(page.getByText('Usa el selector para ver los mejores jugadores con ese brawler.')).toBeVisible();
  await page.getByLabel('Brawler').selectOption({ label: 'Bull' });
  await page.getByRole('button', { name: 'Ver ranking' }).click();
  await expect(page).toHaveURL('/rankings?tipo=brawler&region=global&brawler=16000002');
  await expect(page.getByText('Top 50 · Global · Bull')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'xXProXx' })).toBeVisible();
});

test('a 375px los rankings no tienen scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ['/rankings', '/rankings?tipo=clubes']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Rankings' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
```

`apps/web/e2e/brawlers.spec.ts`:
```ts
import { expect, expectAccessible, expectNoHorizontalScroll, test } from './fixtures';

test('catálogo sin metadatos: 4 brawlers, sin selects de rareza ni clase, accesible y sin scroll a 375px', async ({
  page,
}) => {
  await page.goto('/brawlers');
  await expect(page.getByRole('heading', { level: 1, name: 'Brawlers' })).toBeVisible();
  await expect(page.getByText('Mostrando 4 de 4 brawlers')).toBeVisible();
  await expect(page.getByText('La rareza y la clase todavía no están disponibles.')).toBeVisible();
  await expect(page.getByLabel('Rareza')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Shelly' })).toHaveAttribute('href', '/brawlers/16000000');
  await expectAccessible(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);
});

test('buscar sin acentos ni mayúsculas y quitar filtros', async ({ page }) => {
  await page.goto('/brawlers');
  await page.getByLabel('Buscar brawler').fill('BÚ');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL('/brawlers?q=B%C3%9A');
  await expect(page.getByText('Mostrando 1 de 4 brawlers')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bull' })).toBeVisible();
  await page.getByRole('link', { name: 'Quitar filtros' }).click();
  await expect(page).toHaveURL('/brawlers');
  await expect(page.getByText('Mostrando 4 de 4 brawlers')).toBeVisible();
});

test('sin coincidencias → estado vacío', async ({ page }) => {
  await page.goto('/brawlers?q=zzz');
  await expect(page.getByText('Ningún brawler coincide')).toBeVisible();
  await expect(page.getByText('Mostrando 0 de 4 brawlers')).toBeVisible();
});

test('detalle: gadgets, habilidades estelares y mejores jugadores con link al ranking completo', async ({ page }) => {
  await page.goto('/brawlers');
  await page.getByRole('link', { name: 'Shelly' }).click();
  await expect(page).toHaveURL('/brawlers/16000000');
  await expect(page.getByRole('heading', { level: 1, name: 'Shelly' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Gadgets' })).toContainText('Fast Forward');
  await expect(page.getByRole('region', { name: 'Habilidades estelares' })).toContainText('Shell Shock');
  const top = page.getByRole('region', { name: 'Mejores jugadores' });
  await expect(top.getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
  await expect(top.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute(
    'href',
    '/rankings?tipo=brawler&brawler=16000000',
  );
  await expectAccessible(page);
});

test('id inexistente o mal formado → 404 del brawler', async ({ page }) => {
  await page.goto('/brawlers/99999999');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeVisible();
  await page.goto('/brawlers/abc');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeVisible();
});
```

`apps/web/e2e/about.spec.ts`:
```ts
import { expect, expectAccessible, test } from './fixtures';

test('el footer lleva a Acerca de y la página es accesible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Acerca de BrawlWiki' }).click();
  await expect(page).toHaveURL('/acerca');
  await expect(page.getByRole('heading', { level: 1, name: 'Acerca de BrawlWiki' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fan Content Policy de Supercell' })).toHaveAttribute(
    'href',
    'https://supercell.com/en/fan-content-policy/',
  );
  await expectAccessible(page);
});
```

En `apps/web/e2e/theme.spec.ts`, agregar al final:
```ts
test('en modo claro las secciones nuevas no tienen violaciones de axe', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'theme', value: 'light', url: baseURL }]);
  const paths = [
    '/club/2YPLQ',
    '/clubes/comparar?a=2YPLQ&b=8CGRV',
    '/rankings',
    '/brawlers',
    '/brawlers/16000000',
    '/acerca',
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});
```

- [ ] **Step 2: Correr los E2E y verificar que pasan**

Run: `npm run e2e`
Expected: 39 passed (1 de setup, 37 de main y 1 de cooldown).

Si un test falla, seguir esta guía. **Nunca** desactivar reglas de axe ni aflojar aserciones; si se corrige un componente, va en DONE_WITH_CONCERNS con la salida que lo motivó.
- **Violación real de axe** (por ejemplo `color-contrast`, `link-in-text-block` o `select-name`): corregir el componente o el token con el cambio mínimo.
- **El texto o rol que asserta el spec no coincide con lo que renderiza la página:** confirmar en el código fuente del componente cuál es el texto real antes de tocar el spec.
- **Un formulario GET no navega:** el `<button>` tiene que ser `type="submit"` y el `<form>` tiene que tener `method="get"` y `action`.
- **Para ver qué pasó:** `npx playwright show-report apps/web/playwright-report`.

- [ ] **Step 3: Medir con Lighthouse (móvil)**

El spec (sección 8) pide medir antes de cerrar la v1, con estos objetivos en `/` y `/jugador/[tag]`: LCP < 1.5 s, CLS < 0.05 y TBT < 200 ms. Se mide contra un build de producción, con la API en modo fixtures. Se usan los puertos 3100 y 4100; **el 3000 es de otro proceso del usuario y no se toca.**

Run, desde la raíz, en Git Bash:
```bash
mkdir -p test-results
SUPERCELL_MOCK=1 HOST=127.0.0.1 PORT=4100 LOG_LEVEL=warn REDIS_URL= npm run start -w @brawlwiki/api > test-results/lh-api.log 2>&1 &
export API_INTERNAL_URL=http://127.0.0.1:4100/api/v1 NEXT_PUBLIC_SITE_URL=http://localhost:3100
npm run build -w @brawlwiki/web
npm run start -w @brawlwiki/web -- -p 3100 > test-results/lh-web.log 2>&1 &
until curl -s -o /dev/null http://localhost:3100/ && curl -s -o /dev/null http://127.0.0.1:4100/api/v1/health; do sleep 2; done
curl -s http://127.0.0.1:4100/api/v1/health
export CHROME_PATH="$(cd apps/web && node -e "console.log(require('@playwright/test').chromium.executablePath())")"
for path in / /jugador/2PP /club/2YPLQ /rankings /brawlers; do
  name="lighthouse$(echo "$path" | tr '/' '_').json"
  npx -y lighthouse@13 "http://localhost:3100$path" --only-categories=performance,accessibility \
    --chrome-flags="--headless=new" --output=json --output-path="test-results/$name" --quiet
done
node -e "
const fs = require('fs');
for (const f of fs.readdirSync('test-results').filter((f) => f.startsWith('lighthouse'))) {
  const r = JSON.parse(fs.readFileSync('test-results/' + f, 'utf8'));
  const a = r.audits;
  console.log(f.padEnd(34), 'perf', Math.round(r.categories.performance.score * 100), 'a11y',
    Math.round(r.categories.accessibility.score * 100), 'LCP', (a['largest-contentful-paint'].numericValue / 1000).toFixed(2) + 's',
    'CLS', a['cumulative-layout-shift'].numericValue.toFixed(3), 'TBT', Math.round(a['total-blocking-time'].numericValue) + 'ms');
}"
for port in 3100 4100; do
  pid=$(netstat -ano | grep -E ":$port .*LISTENING" | awk '{print $5}' | head -1)
  [ -n "$pid" ] && taskkill //PID "$pid" //T //F
done
netstat -ano | grep -E ":(3100|4100) .*LISTENING" || echo "puertos 3100 y 4100 libres"
```
Expected:
- `/health` responde `"supercell":"mock"`. Si no, **detenerse**: la medición estaría pegándole a Supercell con la key real.
- Hay una línea de métricas por página, y al final los puertos 3100 y 4100 quedan libres.
- Lighthouse 13 mide en móvil por defecto (Moto G Power con throttling simulado).
- **No se optimiza nada en esta tarea.** Si `/` o `/jugador/2PP` no cumplen los objetivos, reportar DONE_WITH_CONCERNS con los números y las 3 oportunidades de mayor ahorro de cada página (`audits` con `details.type === 'opportunity'`, ordenadas por `details.overallSavingsMs`). El controlador decide.
- `npm run e2e` vuelve a compilar `.next` cuando lo necesita, así que el build de esta medición no afecta a nada.

- [ ] **Step 4: README**

En `README.md`, reemplazar todo desde la línea `## Comandos` hasta el final del archivo por lo siguiente. Completar la tabla de rendimiento con los números del Step 3 y la fecha del día:
```markdown
## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web juntas (también `npm run dev:api` y `npm run dev:web`) |
| `npm test` | Tests unitarios de todos los paquetes |
| `npm run typecheck` | Chequeo de tipos |
| `npm run e2e` | Playwright + axe. Levanta su propia API con fixtures (:4100) y un build de producción de la web (:3100). La primera vez: `npx playwright install chromium` |
| `npm run meta:import -w @brawlwiki/api -- <ruta absoluta a brawlers.json>` | Actualiza rareza y clase de los brawlers. El JSON se descarga desde el navegador en https://api.brawlify.com/v1/brawlers |

- `npm run e2e` deja en `apps/web/.next` un build con `NEXT_PUBLIC_SITE_URL=http://localhost:3100`; antes de desplegar, correr `npm run build -w @brawlwiki/web` con las variables de producción.
- Mientras no se corra `meta:import`, la API no tiene rareza ni clase: el catálogo oculta esos filtros y el detalle muestra "Sin dato".

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
| `/acerca` | Origen de los datos, privacidad y aviso legal |

## Rendimiento

Medido con Lighthouse 13 (móvil, throttling simulado) contra un build de producción y la API en modo fixtures. El spec pide LCP < 1.5 s, CLS < 0.05 y TBT < 200 ms en `/` y `/jugador/[tag]`.

| Página | Performance | Accesibilidad | LCP | CLS | TBT |
|---|---|---|---|---|---|
| `/` | | | | | |
| `/jugador/2PP` | | | | | |
| `/club/2YPLQ` | | | | | |
| `/rankings` | | | | | |
| `/brawlers` | | | | | |

Medido el AAAA-MM-DD.

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`.
```
Las celdas vacías y la fecha se completan con los valores reales del Step 3; no deben quedar vacías.

- [ ] **Step 5: Verificación final de todo el repo**

Run:
```bash
npm test && npm run typecheck && npm run e2e
git grep -nE '^SUPERCELL_API_KEY=[^[:space:]]' -- apps/api/.env.example
git status --short
```
Expected:
- Tests unitarios: shared 14, api 103 (+4 omitidos) y web 109.
- Typecheck limpio y E2E 39 passed.
- `git grep` **no imprime nada**: la key real nunca va en `.env.example`. El patrón ignora el `\r` de CRLF.
- `git status` muestra solo los archivos de esta tarea: nada de `.env`, `test-results/` ni `playwright-report/`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e README.md
git commit -m "test(web): E2E de clubes, comparador, rankings, brawlers y Acerca de; mediciones de Lighthouse en el README

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```
