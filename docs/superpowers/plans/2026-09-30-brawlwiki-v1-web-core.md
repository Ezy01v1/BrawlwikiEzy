# BrawlWiki v1 — Plan 2: `web` (base + inicio + perfil de jugador)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend Next.js 16 (`apps/web`) con el design system "Negro competitivo", el layout mobile-first, la página de inicio (búsqueda, recientes, eventos) y el perfil de jugador completo (resumen, brawlers, battle log e imagen OG), consumiendo solo la API interna del Plan 1, con tests unitarios y E2E.

**Architecture:** App Router con Server Components. Solo el servidor de Next habla con Express, a través de `src/lib/queries.ts`, y reenvía `X-Forwarded-For`. Los errores de la API se renderizan en línea con `ApiErrorView` y **no se lanzan** a `error.tsx`, porque Next oculta los mensajes en producción; `NOT_FOUND` llama a `notFound()`. Tabs, orden y filtros viven en la URL. El battle log se carga en streaming con `<Suspense>`. Los componentes de cliente son solo los interactivos: búsqueda, tema, favoritos, recientes, número animado e imágenes con fallback.

**Tech Stack:** Next.js 16.3.7, React 19.3, Tailwind CSS 4.3 (`@tailwindcss/postcss`), Zod 4 (vía `@brawlwiki/shared`), Vitest 5 + Testing Library + jsdom, Playwright 1.63 + @axe-core/playwright, concurrently 10.

**Spec:** `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md` (secciones 5, 6, 7 y 8). **Plan 3** (después de este): clubes, comparador, rankings, catálogo y detalle de brawlers, página "Acerca de", imagen OG de club y Lighthouse.

**Documentación de Next 16:** está dentro del paquete, en `node_modules/next/dist/docs/`. Ante cualquier duda de API, leer ahí antes de suponer. Next 16 cambió cosas respecto de versiones anteriores.

## Global Constraints

- Versiones: `next@16.3.7`, `react@19.3.0`, `react-dom@19.3.0`, `tailwindcss@^4.3.3` con `@tailwindcss/postcss@^4.3.3`. TypeScript `~5.9.3` (el de la raíz). Node 24. Paquete `"type": "module"`.
- App Router con carpeta `src/` y alias `@/*` → `apps/web/src/*`. Las rutas y todo el texto de la interfaz van en **español**.
- Next 16: `params`, `searchParams`, `cookies()` y `headers()` son **asíncronos** (siempre `await`). Las páginas usan el tipo global `PageProps<'/ruta/[param]'>`, que genera `next typegen`. `error.tsx` recibe `{ error, retry }`. La imagen OG recibe `params` como `Promise`.
- El navegador **nunca** llama a Express. Solo el servidor de Next lo hace, a través de `src/lib/queries.ts`, con:
  - `API_INTERNAL_URL` (por defecto `http://127.0.0.1:4000/api/v1`);
  - `cache: 'no-store'`;
  - timeout de **6000 ms**. El cliente de Supercell en Express usa 2500 ms para que el fallback stale llegue antes de que Next corte; no subir uno sin revisar el otro;
  - el header `X-Forwarded-For` reenviado **tal cual** desde el request entrante (o `x-real-ip` si no existe; si no hay ninguno, no se envía).
- Las respuestas se validan con los esquemas de `@brawlwiki/shared` (`envelopeSchema`). Si la forma no coincide, se genera `ApiError('INTERNAL')` y un `console.error`.
- Los errores de la API se muestran en línea con `ApiErrorView`: `UPSTREAM_MAINTENANCE` usa `MaintenanceNotice` y el resto `ErrorState`. **No se lanzan** a `error.tsx`. `NOT_FOUND` llama a `notFound()`.
- Los componentes de cliente importan la validación de tags desde `@brawlwiki/shared/tags`, **no** desde `@brawlwiki/shared`, para no meter Zod en el bundle del navegador.
- Tokens (variables CSS; dark es el valor por defecto en `:root` y light va en `[data-theme="light"]`):

| Token | Dark | Light |
|---|---|---|
| `bg` | `#0B0B0F` | `#F5F5F7` |
| `surface` | `#15151C` | `#FFFFFF` |
| `surface-2` | `#1F1F29` | `#EDEDF2` |
| `border` | `#2C2C3A` | `#D6D6DF` |
| `fg` | `#F2F2F5` | `#121218` |
| `muted` | `#A1A1B3` | `#565669` |
| `primary` | `#FFC61A` | `#8A6300` |
| `primary-fill` | `#FFC61A` | `#FFC61A` |
| `on-primary` | `#14110A` | `#14110A` |
| `primary-shadow` | `#A87F00` | `#A87F00` |
| `accent` | `#FF8A1A` | `#A84C00` |
| `win` | `#3EDC81` | `#0B7A3B` |
| `loss` | `#FF5C6F` | `#C21F37` |
| `info` | `#4DB8FF` | `#0A62B0` |

- Tipografía: **Lilita One** (`--font-lilita`) solo en títulos y números grandes; **Inter** (`--font-inter`) en todo lo demás. Todos los números usan `tabular-nums` y se formatean con `Intl.NumberFormat('es-MX')`.
- Radios: `rounded-chip` = 8px, `rounded-card` = 12px.
- Accesibilidad:
  - áreas táctiles de al menos 44px (`min-h-11`);
  - foco visible (`outline: 2px solid var(--primary-fill)` con offset de 2px);
  - con `prefers-reduced-motion` se desactivan las animaciones;
  - el resultado de cada partida se comunica con texto, no solo con color.
- El disclaimer exacto, **"Este material es no oficial y no está avalado por Supercell."**, va en el `Footer` de todas las páginas y en la imagen OG.
- Tema: dark por defecto, guardado en la cookie `theme` (`dark` | `light`, `path=/`, 1 año, `samesite=lax`). `RootLayout` la lee en el servidor para que no haya parpadeo.
- `localStorage` usa las claves `bw:recent` (máximo 10) y `bw:favorites`. Toda lectura y escritura va en `try/catch`.
- Imágenes: `next/image` con `remotePatterns: [new URL('https://cdn.brawlify.com/**')]`. Si `src` es `null` o la carga falla, `GameImage` muestra un fallback con iniciales.
- Mensajes de commit estilo conventional (`feat(web): …`), terminados en la línea `Co-Authored-By` del modelo que escribió el código.
- Los comandos se ejecutan desde la raíz del repo en **Git Bash** (Windows).

## Review Focus

1. **Nombres largos, emojis o sin espacios** ("Heaven🍁", "xXxPROxXxGAMERxXx"). Se espera que en 375px no haya scroll horizontal (el nombre se trunca). Test en Task 12 (`scrollWidth <= innerWidth`) y en Task 9 (`truncate` en el `h1`).
2. **Jugador con battle log vacío** (pasa con jugadores reales, por ejemplo el top 1 global). Se espera `EmptyState` y un resumen sin `NaN%`. Tests en Task 10 (`summarizeBattles([])` da `winRate: null`; `BattleLog` vacío).
3. **`localStorage` que no está disponible o tiene JSON corrupto.** Se espera que los recientes y favoritos devuelvan `[]` sin romper la página. Test en Task 6.
4. **Express caído o con timeout.** Se espera `ErrorState` con "No pudimos conectar con BrawlWiki", sin pantalla en blanco ni 500. Tests en Task 3 (`NETWORK` por fetch rechazado y por timeout) y Task 5 (título de `NETWORK`).
5. **Tag escrito "sucio"** (`" #2pp "`, con la letra O). Se espera navegar a `/jugador/2PP` normalizado; si es inválido, se muestra el mensaje en línea y no se navega. Test en Task 6.

---

## Estructura de archivos

```
apps/web/
├── package.json · tsconfig.json · next.config.ts · postcss.config.mjs
├── vitest.config.mts · vitest.setup.ts · playwright.config.ts · .env.example
├── src/
│   ├── assets/fonts/LilitaOne-Regular.ttf       (para la imagen OG)
│   ├── app/
│   │   ├── globals.css                          tokens, Tailwind v4, skeleton, reduced motion
│   │   ├── layout.tsx                           fuentes, cookie de tema, Header/Footer/BottomNav
│   │   ├── page.tsx                             inicio
│   │   ├── not-found.tsx · error.tsx            404 y error genérico
│   │   └── jugador/[tag]/
│   │       ├── page.tsx · loading.tsx · not-found.tsx · opengraph-image.tsx
│   ├── lib/
│   │   ├── format.ts          formatNumber, formatAge, timeAgo, timeLeft, signed, displayName
│   │   ├── theme.ts           Theme, THEME_COOKIE, parseTheme, themeCookie
│   │   ├── api.ts             ApiError, apiGet (testeable, sin next/headers)
│   │   ├── queries.ts         getPlayer, getBattleLog, getEventRotation (usa next/headers)
│   │   ├── attempt.ts         attempt(promise) → { ok, value } | { ok: false, error }
│   │   ├── local-store.ts     recientes y favoritos
│   │   ├── modes.ts           nombres de modos en español
│   │   ├── brawlers.ts        BrawlerOrder, parseOrder, sortBrawlers
│   │   ├── battles.ts         battleOutcome, summarizeBattles, findPlayer
│   │   ├── player-route.ts    resolveTag, playerTabs
│   │   └── search-params.ts   first(), parseTab()
│   └── components/
│       ├── ui/        Button, Card, Chip, Skeleton, GameImage, AnimatedNumber, Tabs, Disclaimer, ThemeToggle
│       ├── states/    StaleBadge, ErrorState, MaintenanceNotice, EmptyState, ApiErrorView
│       ├── search/    TagSearch, RecentSearches, FavoriteButton, RecordVisit
│       ├── layout/    Header, NavLinks, Footer, HydrationFlag
│       ├── events/    EventCard, EventRotation, EventsSkeleton
│       ├── brawler/   BrawlerTile, BrawlerGrid
│       └── player/    PlayerHeader, PlayerStats, PlayerOverview, BattleRow, BattleLog,
│                      BattleLogSkeleton, BattleLogSection, InvalidTag
├── test/              tests unitarios (Vitest + Testing Library)
└── e2e/               fixtures.ts, mock.setup.ts y specs de Playwright + axe
```

Cambios fuera de `apps/web`:
- `package.json` de la raíz: scripts `dev`, `dev:api` y `dev:web` con concurrently (Task 1) y `e2e` (Task 12).
- `packages/shared/package.json`: subpath `./tags`.
- `.gitignore`: se agrega `next-env.d.ts`.
- `README.md`: sección de desarrollo.

---

### Task 1: Scaffold de `apps/web` + utilidades de formato

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/vitest.config.mts`, `apps/web/vitest.setup.ts`, `apps/web/.env.example`
- Create: `apps/web/src/app/globals.css` (mínimo), `apps/web/src/app/layout.tsx` (mínimo), `apps/web/src/app/page.tsx` (provisional)
- Create: `apps/web/src/lib/format.ts`
- Modify: `package.json` (raíz), `.gitignore`
- Test: `apps/web/test/format.test.ts`

**Interfaces:**
- Consumes: `@brawlwiki/shared` (workspace).
- Produces:
  - `formatNumber(n: number): string` (es-MX: `42310` da `"42,310"`)
  - `formatAge(seconds: number): string` (`"unos segundos"` si es menos de 60; luego `"N min"`, `"N h"`, `"N d"`)
  - `timeAgo(iso: string, now?: number): string` (`"hace " + formatAge(...)`)
  - `timeLeft(iso: string, now?: number): string`: `"terminado"` si ya pasó; `"menos de 1 min"`; `"N min"`; `"N h"`; `"N h M min"`
  - `signed(n: number): string` (`8` da `"+8"`, `-6` da `"−6"` con signo menos U+2212, `0` da `"0"`)
  - `displayName(raw: string): string` (`"EL PRIMO"` da `"El Primo"`, `"8-BIT"` da `"8-Bit"`, `"MR. P"` da `"Mr. P"`)
  - Scripts de `@brawlwiki/web`: `dev`, `build`, `start`, `test`, `typecheck`. Script raíz `dev` que levanta api y web.

- [ ] **Step 1: Crear el paquete y la configuración**

`apps/web/package.json`:
```json
{
  "name": "@brawlwiki/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@brawlwiki/shared": "*",
    "next": "16.3.7",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^30.1.1",
    "tailwindcss": "^4.3.3"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@brawlwiki/shared'],
  images: {
    remotePatterns: [new URL('https://cdn.brawlify.com/**')],
  },
};

export default nextConfig;
```

`apps/web/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`apps/web/vitest.config.mts`:
```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`apps/web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.cookie = 'theme=; max-age=0; path=/';
});
```

`apps/web/.env.example`:
```
# URL interna de la API (solo la usa el servidor de Next; nunca el navegador)
API_INTERNAL_URL=http://127.0.0.1:4000/api/v1
# URL pública del sitio (metadatos e imágenes OG)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`apps/web/src/app/globals.css` (provisional; la Task 2 lo reemplaza completo):
```css
@import "tailwindcss";
```

`apps/web/src/app/layout.tsx` (provisional; la Task 2 lo reemplaza):
```tsx
import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx` (provisional; la Task 8 lo reemplaza):
```tsx
export default function HomePage() {
  return <h1>BrawlWiki</h1>;
}
```

Agregar al final de `.gitignore` de la raíz:
```
next-env.d.ts
```

Run: `npm install && npm install -D concurrently@^10.0.5`

Después, en el `package.json` de la raíz, reemplazar el script `dev` y agregar `dev:api` y `dev:web`. `test` y `typecheck` quedan como están:
```json
    "dev": "concurrently -n api,web -c yellow,cyan \"npm run dev -w @brawlwiki/api\" \"npm run dev -w @brawlwiki/web\"",
    "dev:api": "npm run dev -w @brawlwiki/api",
    "dev:web": "npm run dev -w @brawlwiki/web",
```
Expected: el install termina sin errores y `node_modules/next` queda en la versión 16.3.7.

- [ ] **Step 2: Escribir el test que falla**

`apps/web/test/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { displayName, formatAge, formatNumber, signed, timeAgo, timeLeft } from '@/lib/format';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

describe('format', () => {
  it('formatNumber usa separador de miles es-MX', () => {
    expect(formatNumber(42310)).toBe('42,310');
    expect(formatNumber(1200)).toBe('1,200');
    expect(formatNumber(7)).toBe('7');
  });

  it('formatAge', () => {
    expect(formatAge(0)).toBe('unos segundos');
    expect(formatAge(59)).toBe('unos segundos');
    expect(formatAge(60)).toBe('1 min');
    expect(formatAge(3599)).toBe('59 min');
    expect(formatAge(7200)).toBe('2 h');
    expect(formatAge(3 * 86400)).toBe('3 d');
    expect(formatAge(-5)).toBe('unos segundos');
  });

  it('timeAgo', () => {
    expect(timeAgo('2026-09-29T11:56:00.000Z', NOW)).toBe('hace 4 min');
  });

  it('timeLeft', () => {
    expect(timeLeft('2026-09-29T11:00:00.000Z', NOW)).toBe('terminado');
    expect(timeLeft('2026-09-29T12:00:30.000Z', NOW)).toBe('menos de 1 min');
    expect(timeLeft('2026-09-29T12:40:00.000Z', NOW)).toBe('40 min');
    expect(timeLeft('2026-09-29T15:00:00.000Z', NOW)).toBe('3 h');
    expect(timeLeft('2026-09-29T13:20:00.000Z', NOW)).toBe('1 h 20 min');
  });

  it('signed', () => {
    expect(signed(8)).toBe('+8');
    expect(signed(-6)).toBe('−6');
    expect(signed(0)).toBe('0');
  });

  it('displayName pasa nombres de Supercell a formato título', () => {
    expect(displayName('SHELLY')).toBe('Shelly');
    expect(displayName('EL PRIMO')).toBe('El Primo');
    expect(displayName('8-BIT')).toBe('8-Bit');
    expect(displayName('MR. P')).toBe('Mr. P');
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web`
Expected: FAIL, "Failed to resolve import @/lib/format".

- [ ] **Step 4: Implementar**

`apps/web/src/lib/format.ts`:
```ts
const numberFormat = new Intl.NumberFormat('es-MX');

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return 'unos segundos';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  return `hace ${formatAge((now - Date.parse(iso)) / 1000)}`;
}

export function timeLeft(iso: string, now: number = Date.now()): string {
  const s = Math.floor((Date.parse(iso) - now) / 1000);
  if (s <= 0) return 'terminado';
  const m = Math.floor(s / 60);
  if (m < 1) return 'menos de 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** Supercell envía los nombres de brawlers en mayúsculas ("EL PRIMO"). */
export function displayName(raw: string): string {
  return raw.toLowerCase().replace(/(^|[\s\-.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
```

- [ ] **Step 5: Correr los tests, el typecheck y el build, y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected:
- Tests: PASS (6).
- Typecheck limpio (`next typegen` genera los tipos en `.next/`).
- `next build` compila `/` sin errores. Si Turbopack no resuelve el TS de `@brawlwiki/shared`, confirmar que `transpilePackages` está presente y que `packages/shared/package.json` exporta `./src/index.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/web package.json package-lock.json .gitignore
git commit -m "feat(web): scaffold Next.js 16 + utilidades de formato

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 2: Design system (tokens, fuentes, tema) + `ThemeToggle`

**Files:**
- Modify: `apps/web/src/app/globals.css` (archivo completo), `apps/web/src/app/layout.tsx` (archivo completo)
- Create: `apps/web/src/lib/theme.ts`, `apps/web/src/components/ui/ThemeToggle.tsx`
- Test: `apps/web/test/theme.test.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `type Theme = 'dark' | 'light'`, `THEME_COOKIE = 'theme'`, `parseTheme(v: string | null | undefined): Theme` (todo lo que no sea `'light'` da `'dark'`), `themeCookie(theme: Theme): string`
  - `ThemeToggle()` (cliente): alterna `document.documentElement.dataset.theme` y la cookie. Su `aria-label` es `"Cambiar a modo claro"` o `"Cambiar a modo oscuro"`.
  - Utilidades de Tailwind a partir de los tokens: `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-fg`, `text-muted`, `text-primary`, `bg-primary-fill`, `text-on-primary`, `text-accent`, `bg-accent`, `text-win`, `bg-win`, `text-loss`, `bg-loss`, `text-info`, `font-display`, `font-sans`, `rounded-chip`, `rounded-card`
  - Clase CSS `.skeleton` (brillo animado que se desactiva con reduced motion)
  - `RootLayout` async que lee la cookie y pone `data-theme` en `<html>`

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/theme.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { parseTheme, themeCookie } from '@/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
  });

  it('parseTheme: dark por defecto', () => {
    expect(parseTheme(undefined)).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('rosa')).toBe('dark');
  });

  it('themeCookie dura un año en todo el sitio', () => {
    expect(themeCookie('light')).toBe('theme=light; path=/; max-age=31536000; samesite=lax');
  });

  it('ThemeToggle alterna data-theme y guarda la cookie', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a modo claro' });
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toContain('theme=light');
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- theme`
Expected: FAIL, "Failed to resolve import @/components/ui/ThemeToggle".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/theme.ts`:
```ts
export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'theme';

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
```

`apps/web/src/components/ui/ThemeToggle.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { parseTheme, type Theme, themeCookie } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(parseTheme(document.documentElement.dataset.theme));
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = themeCookie(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="inline-flex size-11 items-center justify-center rounded-chip text-muted transition-colors hover:text-fg"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
```

`apps/web/src/app/globals.css` (archivo completo):
```css
@import "tailwindcss";

:root {
  color-scheme: dark;
  --bg: #0b0b0f;
  --surface: #15151c;
  --surface-2: #1f1f29;
  --border: #2c2c3a;
  --fg: #f2f2f5;
  --muted: #a1a1b3;
  --primary: #ffc61a;
  --primary-fill: #ffc61a;
  --on-primary: #14110a;
  --primary-shadow: #a87f00;
  --accent: #ff8a1a;
  --win: #3edc81;
  --loss: #ff5c6f;
  --info: #4db8ff;
}

[data-theme="light"] {
  color-scheme: light;
  --bg: #f5f5f7;
  --surface: #ffffff;
  --surface-2: #ededf2;
  --border: #d6d6df;
  --fg: #121218;
  --muted: #565669;
  --primary: #8a6300;
  --primary-fill: #ffc61a;
  --on-primary: #14110a;
  --primary-shadow: #a87f00;
  --accent: #a84c00;
  --win: #0b7a3b;
  --loss: #c21f37;
  --info: #0a62b0;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-primary: var(--primary);
  --color-primary-fill: var(--primary-fill);
  --color-on-primary: var(--on-primary);
  --color-primary-shadow: var(--primary-shadow);
  --color-accent: var(--accent);
  --color-win: var(--win);
  --color-loss: var(--loss);
  --color-info: var(--info);
  --font-display: var(--font-lilita), system-ui, sans-serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --radius-chip: 8px;
  --radius-card: 12px;
}

html {
  background: var(--bg);
}

body {
  background: var(--bg);
  color: var(--fg);
}

:focus-visible {
  outline: 2px solid var(--primary-fill);
  outline-offset: 2px;
}

.skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--surface-2) 0%, var(--border) 50%, var(--surface-2) 100%);
  background-size: 200% 100%;
  animation: bw-shimmer 1.4s linear infinite;
}

@keyframes bw-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`apps/web/src/app/layout.tsx` (archivo completo; la Task 7 agrega Header, Footer y BottomNav):
```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Lilita_One } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'BrawlWiki', template: '%s · BrawlWiki' },
  description: 'Stats de jugadores, clubes y rankings de Brawl Stars. Fan page no oficial.',
};

export const viewport: Viewport = { themeColor: '#0b0b0f', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="es" data-theme={theme} className={`${lilita.variable} ${inter.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Correr los tests y el build, y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (9 tests acumulados), typecheck limpio y build OK. El build descarga Lilita One e Inter de Google Fonts, así que necesita red.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): design system Negro competitivo (tokens, fuentes, tema con cookie)

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 3: Cliente de la API interna (`apiGet`, `queries`, `attempt`)

**Files:**
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queries.ts`, `apps/web/src/lib/attempt.ts`
- Test: `apps/web/test/api.test.ts`

**Interfaces:**
- Consumes: `ApiErrorBodySchema`, `envelopeSchema`, `ErrorCode`, `Meta`, `PlayerSchema`, `BattleSchema`, `EventSlotSchema` de `@brawlwiki/shared`.
- Produces:
  - `type ApiErrorCode = ErrorCode | 'NETWORK'`
  - `class ApiError extends Error { code: ApiErrorCode; status: number; retryAfter?: number; requestId?: string }`, con constructor `new ApiError(code, message, { status, retryAfter?, requestId? })`
  - `interface ApiResult<T> { data: T; meta: Meta }`
  - `apiGet<T>(path: string, schema: z.ZodType<T>, opts?: { baseUrl?: string; fetchImpl?: typeof fetch; forwardedFor?: string | null; timeoutMs?: number }): Promise<ApiResult<T>>`
  - `DEFAULT_API_URL = 'http://127.0.0.1:4000/api/v1'`, `API_TIMEOUT_MS = 6000`
  - `queries.ts`: `getPlayer(tag): Promise<ApiResult<Player>>`, `getBattleLog(tag): Promise<ApiResult<Battle[]>>`, `getEventRotation(): Promise<ApiResult<EventSlot[]>>`. Todas reenvían `x-forwarded-for` (o `x-real-ip`) del request entrante y van envueltas en `cache()` de React (una sola llamada a Express por request aunque las usen `generateMetadata` y la página).
  - `type Attempt<T> = { ok: true; value: T } | { ok: false; error: ApiError }`, `attempt<T>(p: Promise<T>): Promise<Attempt<T>>` (vuelve a lanzar lo que no sea `ApiError`)

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/api.test.ts`:
```ts
import { PlayerSchema } from '@brawlwiki/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiGet } from '@/lib/api';
import { attempt } from '@/lib/attempt';

const BASE = 'http://api.test/api/v1';
const META = { source: 'fresh', fetchedAt: '2026-09-29T12:00:00.000Z', ageSeconds: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('apiGet', () => {
  it('devuelve data + meta validados', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: [1, 2], meta: META }));
    const r = await apiGet('/x', z.array(z.number()), { baseUrl: BASE, fetchImpl });
    expect(r).toEqual({ data: [1, 2], meta: META });
  });

  it('arma la URL, pide no-store y reenvía X-Forwarded-For solo si existe', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: 1, meta: META }));
    await apiGet('/players/2PP', z.number(), { baseUrl: BASE, fetchImpl, forwardedFor: '203.0.113.5' });
    await apiGet('/players/2PP', z.number(), { baseUrl: BASE, fetchImpl, forwardedFor: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/players/2PP`);
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('x-forwarded-for')).toBe('203.0.113.5');
    const [, init2] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(init2.headers).has('x-forwarded-for')).toBe(false);
  });

  it('error de la API → ApiError con code, status, retryAfter y requestId', async () => {
    const fetchImpl = vi.fn(async () =>
      json(429, { error: { code: 'RATE_LIMITED', message: 'Espera', requestId: 'r1', retryAfter: 30 } }),
    );
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Espera',
      status: 429,
      retryAfter: 30,
      requestId: 'r1',
    });
  });

  it('error sin cuerpo válido → INTERNAL', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 502 }));
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });
  });

  it('Express caído (fetch rechaza) → NETWORK', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor de BrawlWiki.',
    });
  });

  it('timeout → NETWORK', async () => {
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
    await expect(apiGet('/x', z.number(), { baseUrl: BASE, fetchImpl: hang, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('200 con forma inesperada → INTERNAL y console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json(200, { data: { tag: '#MAL' }, meta: META }));
    await expect(apiGet('/x', PlayerSchema, { baseUrl: BASE, fetchImpl })).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('attempt', () => {
  it('envuelve éxito y ApiError; relanza lo demás', async () => {
    expect(await attempt(Promise.resolve(1))).toEqual({ ok: true, value: 1 });
    const err = new ApiError('NOT_FOUND', 'x', { status: 404 });
    expect(await attempt(Promise.reject(err))).toEqual({ ok: false, error: err });
    await expect(attempt(Promise.reject(new Error('bug')))).rejects.toThrow('bug');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- api`
Expected: FAIL, "Failed to resolve import @/lib/api".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/api.ts`:
```ts
import { ApiErrorBodySchema, envelopeSchema, type ErrorCode, type Meta } from '@brawlwiki/shared';
import type { z } from 'zod';

export const DEFAULT_API_URL = 'http://127.0.0.1:4000/api/v1';
export const API_TIMEOUT_MS = 6000;

export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfter?: number;
  readonly requestId?: string;

  constructor(code: ApiErrorCode, message: string, opts: { status: number; retryAfter?: number; requestId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = opts.status;
    if (opts.retryAfter !== undefined) this.retryAfter = opts.retryAfter;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
  }
}

export interface ApiResult<T> {
  data: T;
  meta: Meta;
}

export interface ApiGetOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  forwardedFor?: string | null;
  timeoutMs?: number;
}

const UNEXPECTED = 'Respuesta inesperada del servidor.';

/** Solo para el servidor de Next: el navegador nunca llama a la API interna. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>, opts: ApiGetOptions = {}): Promise<ApiResult<T>> {
  const base = opts.baseUrl ?? process.env.API_INTERNAL_URL ?? DEFAULT_API_URL;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.forwardedFor) headers['X-Forwarded-For'] = opts.forwardedFor;

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('NETWORK', 'No pudimos conectar con el servidor de BrawlWiki.', { status: 0 });
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(body);
    if (!parsed.success) throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
    const e = parsed.data.error;
    throw new ApiError(e.code, e.message, { status: res.status, retryAfter: e.retryAfter, requestId: e.requestId });
  }

  const parsed = envelopeSchema(schema).safeParse(body);
  if (!parsed.success) {
    console.error('[api] respuesta con forma inesperada', path, parsed.error.issues.slice(0, 3));
    throw new ApiError('INTERNAL', UNEXPECTED, { status: res.status });
  }
  return parsed.data as ApiResult<T>;
}
```

`apps/web/src/lib/attempt.ts`:
```ts
import { ApiError } from './api';

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: ApiError };

/** Convierte un ApiError en valor para renderizarlo en línea (Next oculta los mensajes de errores lanzados en producción). */
export async function attempt<T>(p: Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e };
    throw e;
  }
}
```

`apps/web/src/lib/queries.ts`:
```ts
import { BattleSchema, EventSlotSchema, PlayerSchema } from '@brawlwiki/shared';
import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { apiGet } from './api';

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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (17 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/test/api.test.ts
git commit -m "feat(web): cliente de la API interna con validación, timeout y reenvío de IP

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 4: Primitivos de UI

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`, `Card.tsx`, `Chip.tsx`, `Skeleton.tsx`, `GameImage.tsx`, `AnimatedNumber.tsx`, `Tabs.tsx`, `Disclaimer.tsx` (todos en `apps/web/src/components/ui/`)
- Modify: `apps/web/vitest.setup.ts` (mock global de `next/image`)
- Test: `apps/web/test/ui.test.tsx`

**Interfaces:**
- Consumes: `formatNumber` (Task 1).
- Produces:
  - `buttonClass(variant?: 'primary' | 'secondary' | 'ghost', extra?: string): string`
  - `Button(props: ComponentProps<'button'> & { variant? })`: `type="button"` por defecto
  - `ButtonLink(props: ComponentProps<typeof Link> & { variant? })`
  - `Card(props: ComponentProps<'div'>)`
  - `Chip({ tone?: 'neutral' | 'win' | 'loss' | 'accent', children })`
  - `Skeleton({ className? })`: `aria-hidden`, usa la clase `.skeleton`
  - `initials(text: string): string` (máximo 2 letras; `'?'` si no hay letras ni números)
  - `GameImage({ src: string | null; alt: string; size: number; className?; fallbackText? })` (cliente): si `src` es `null` o falla la carga, muestra `<span role="img" aria-label={alt}>` con las iniciales
  - `AnimatedNumber({ value: number; className? })` (cliente): el servidor renderiza el valor final; el cliente anima de 0 al valor en 700 ms (ease-out) salvo con reduced motion; el valor final siempre va en un `<span class="sr-only">` (no se usa `aria-label` en un `span` sin rol: axe lo marca como `aria-prohibited-attr`)
  - `interface TabItem { href: string; label: string; active: boolean }`, `Tabs({ items: TabItem[]; label: string })`: `<nav>` con `aria-current="page"` en el tab activo y links con `scroll={false}`
  - `DISCLAIMER` (constante con el texto exacto), `Disclaimer({ className? })`

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/ui.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DISCLAIMER, Disclaimer } from '@/components/ui/Disclaimer';
import { GameImage, initials } from '@/components/ui/GameImage';
import { Tabs } from '@/components/ui/Tabs';

describe('Button', () => {
  it('es type=button por defecto y ButtonLink es un enlace', () => {
    render(
      <>
        <Button>Buscar</Button>
        <ButtonLink href="/rankings">Rankings</ButtonLink>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('link', { name: 'Rankings' })).toHaveAttribute('href', '/rankings');
  });
});

describe('GameImage', () => {
  it('muestra la imagen y cae al fallback con iniciales si falla la carga', () => {
    render(<GameImage src="https://cdn.brawlify.com/brawlers/borderless/1.png" alt="Shelly" size={64} />);
    fireEvent.error(screen.getByRole('img', { name: 'Shelly' }));
    const fallback = screen.getByRole('img', { name: 'Shelly' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveTextContent('S');
  });

  it('src null → fallback directo con fallbackText', () => {
    render(<GameImage src={null} alt="Badge del club" size={48} fallbackText="Los Cracks" />);
    expect(screen.getByRole('img', { name: 'Badge del club' })).toHaveTextContent('LC');
  });

  it('initials', () => {
    expect(initials('EzyPlayer')).toBe('E');
    expect(initials('mr p')).toBe('MP');
    expect(initials('🍁')).toBe('?');
  });
});

describe('AnimatedNumber', () => {
  it('con reduced motion muestra el valor final y siempre lo expone en texto sr-only', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { container } = render(<AnimatedNumber value={42310} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('42,310');
    expect(screen.getByText('42,310', { selector: '.sr-only' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('Tabs y Disclaimer', () => {
  it('marca solo el tab activo con aria-current', () => {
    render(
      <Tabs
        label="Secciones"
        items={[
          { href: '/a', label: 'Resumen', active: false },
          { href: '/a?tab=b', label: 'Brawlers', active: true },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Brawlers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Resumen' })).not.toHaveAttribute('aria-current');
  });

  it('Disclaimer usa el texto exacto', () => {
    render(<Disclaimer />);
    expect(DISCLAIMER).toBe('Este material es no oficial y no está avalado por Supercell.');
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
```

Además, `apps/web/vitest.setup.ts` suma un mock **global** de `next/image`, porque varias tareas renderizan `GameImage` y `next/image` no funciona en jsdom sin el servidor de imágenes. Archivo completo:
```tsx
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ImgHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

// next/image necesita el optimizador de Next; en jsdom se reemplaza por un <img> simple.
vi.mock('next/image', () => ({
  default: ({ src, alt, onError, width, height, className }: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement('img', { src, alt, onError, width, height, className }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.cookie = 'theme=; max-age=0; path=/';
});
```
(Se usa `createElement` porque `vitest.setup.ts` es `.ts`, no `.tsx`.)

Si `next/link` falla al renderizar en jsdom (por falta de contexto de router), agregar en `vitest.setup.ts` un mock global de `next/link` que renderice un `<a href={href} {...rest}>`. Anotarlo en el reporte.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- ui`
Expected: FAIL, "Failed to resolve import @/components/ui/AnimatedNumber".

- [ ] **Step 3: Implementar**

`apps/web/src/components/ui/Button.tsx`:
```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary-fill text-on-primary font-display tracking-wide shadow-[0_3px_0_var(--primary-shadow)] hover:brightness-105 active:translate-y-0.5 active:shadow-[0_1px_0_var(--primary-shadow)]',
  secondary: 'border border-border font-semibold text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg',
};

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-sm transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-50';

export function buttonClass(variant: Variant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({ variant = 'primary', className = '', ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}
```

`apps/web/src/components/ui/Card.tsx`:
```tsx
import type { ComponentProps } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`rounded-card border border-border bg-surface p-3 ${className}`} />;
}
```

`apps/web/src/components/ui/Chip.tsx`:
```tsx
import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  win: 'bg-win/15 text-win',
  loss: 'bg-loss/15 text-loss',
  accent: 'bg-accent/15 text-accent',
} as const;

export function Chip({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
```

`apps/web/src/components/ui/Skeleton.tsx`:
```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
```

`apps/web/src/components/ui/GameImage.tsx`:
```tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

export function initials(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}

interface GameImageProps {
  src: string | null;
  alt: string;
  size: number;
  className?: string;
  fallbackText?: string;
}

/** Imagen del CDN con fallback: nunca se muestra un ícono roto. */
export function GameImage({ src, alt, size, className = '', fallbackText }: GameImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded-chip bg-surface-2 font-display text-muted ${className}`}
      >
        {initials(fallbackText ?? alt)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
```

`apps/web/src/components/ui/AnimatedNumber.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/format';

const DURATION_MS = 700;

export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION_MS);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span aria-hidden="true">{formatNumber(shown)}</span>
      <span className="sr-only">{formatNumber(value)}</span>
    </span>
  );
}
```

`apps/web/src/components/ui/Tabs.tsx`:
```tsx
import Link from 'next/link';

export interface TabItem {
  href: string;
  label: string;
  active: boolean;
}

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="my-3 flex gap-1 rounded-card bg-surface-2 p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-chip text-sm font-semibold transition-colors ${
            item.active ? 'bg-primary-fill text-on-primary' : 'text-muted hover:text-fg'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

`apps/web/src/components/ui/Disclaimer.tsx`:
```tsx
export const DISCLAIMER = 'Este material es no oficial y no está avalado por Supercell.';

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-muted ${className}`}>{DISCLAIMER}</p>;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (24 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui apps/web/vitest.setup.ts apps/web/test/ui.test.tsx
git commit -m "feat(web): primitivos de UI (botones, tarjetas, imagen con fallback, número animado, tabs)

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 5: Componentes de estado (stale, error, mantenimiento, vacío)

**Files:**
- Create: `apps/web/src/components/states/StaleBadge.tsx`, `ErrorState.tsx`, `MaintenanceNotice.tsx`, `EmptyState.tsx`, `ApiErrorView.tsx` (todos en `apps/web/src/components/states/`)
- Test: `apps/web/test/states.test.tsx`

**Interfaces:**
- Consumes: `Meta` de `@brawlwiki/shared`; `ApiError` y `ApiErrorCode` (Task 3); `formatAge` (Task 1); `Button` (Task 4).
- Produces:
  - `StaleBadge({ meta: Meta })`: `null` salvo que `meta.source === 'stale'`; texto `"Dato de hace {formatAge(ageSeconds)} · Supercell no responde"` con `role="status"`
  - `errorTitle(code: ApiErrorCode): string`
  - `ErrorState({ code, message, requestId?, retryAfter?, onRetry? })` (cliente): `role="alert"`. Con `retryAfter`, el botón queda deshabilitado con el texto "Reintentar en N s" y la cuenta regresiva; después dice "Reintentar". Al hacer clic llama a `onRetry` o, si no hay, a `router.refresh()`.
  - `MaintenanceNotice()`: `role="status"`, título "Brawl Stars está en mantenimiento"
  - `EmptyState({ title: string; children?: ReactNode })`
  - `ApiErrorView({ error: ApiError })`: con `UPSTREAM_MAINTENANCE` usa `MaintenanceNotice`; si no, `ErrorState` (le pasa solo primitivos)

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/states.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { ApiError } from '@/lib/api';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const meta = (source: 'fresh' | 'cache' | 'stale', ageSeconds = 0) => ({
  source,
  fetchedAt: '2026-09-29T12:00:00.000Z',
  ageSeconds,
});

afterEach(() => {
  refresh.mockClear();
  vi.useRealTimers();
});

describe('StaleBadge', () => {
  it('no se muestra con datos frescos o de caché', () => {
    const { container } = render(
      <>
        <StaleBadge meta={meta('fresh')} />
        <StaleBadge meta={meta('cache', 90)} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('con stale muestra la edad del dato', () => {
    render(<StaleBadge meta={meta('stale', 7200)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Dato de hace 2 h · Supercell no responde');
  });
});

describe('ErrorState', () => {
  it('título humano según el código, mensaje e ID del request', () => {
    render(<ErrorState code="NETWORK" message="No pudimos conectar con el servidor de BrawlWiki." requestId="req-1" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos conectar con BrawlWiki');
    expect(alert).toHaveTextContent('No pudimos conectar con el servidor de BrawlWiki.');
    expect(alert).toHaveTextContent('req-1');
  });

  it('con retryAfter cuenta hacia atrás y luego permite reintentar (router.refresh)', () => {
    vi.useFakeTimers();
    render(<ErrorState code="RATE_LIMITED" message="Espera" retryAfter={2} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Vas muy rápido');
    expect(screen.getByRole('button', { name: 'Reintentar en 2 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('button', { name: 'Reintentar en 1 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1000));
    const button = screen.getByRole('button', { name: 'Reintentar' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('usa onRetry si se pasa', () => {
    const onRetry = vi.fn();
    render(<ErrorState code="INTERNAL" message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ApiErrorView y EmptyState', () => {
  it('mantenimiento → aviso de mantenimiento; otros → ErrorState', () => {
    const { unmount } = render(
      <ApiErrorView error={new ApiError('UPSTREAM_MAINTENANCE', 'x', { status: 503 })} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Brawl Stars está en mantenimiento');
    unmount();
    render(<ApiErrorView error={new ApiError('UPSTREAM_UNAVAILABLE', 'No pudimos contactar a Supercell.', { status: 503 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Supercell no responde');
  });

  it('EmptyState', () => {
    render(<EmptyState title="Sin partidas recientes">Juega una partida.</EmptyState>);
    expect(screen.getByText('Sin partidas recientes')).toBeInTheDocument();
    expect(screen.getByText('Juega una partida.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- states`
Expected: FAIL, "Failed to resolve import @/components/states/ApiErrorView".

- [ ] **Step 3: Implementar**

`apps/web/src/components/states/StaleBadge.tsx`:
```tsx
import type { Meta } from '@brawlwiki/shared';
import { formatAge } from '@/lib/format';

export function StaleBadge({ meta }: { meta: Meta }) {
  if (meta.source !== 'stale') return null;
  return (
    <p role="status" className="my-2 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
      <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
      Dato de hace {formatAge(meta.ageSeconds)} · Supercell no responde
    </p>
  );
}
```

`apps/web/src/components/states/ErrorState.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ApiErrorCode } from '@/lib/api';

const TITLES: Partial<Record<ApiErrorCode, string>> = {
  RATE_LIMITED: 'Vas muy rápido 😅',
  UPSTREAM_RATE_LIMITED: 'Vas muy rápido 😅',
  UPSTREAM_UNAVAILABLE: 'Supercell no responde',
  NETWORK: 'No pudimos conectar con BrawlWiki',
  INVALID_TAG: 'Revisa el tag',
  INVALID_PARAM: 'Revisa los filtros',
  NOT_FOUND: 'No encontramos lo que buscas',
};

export function errorTitle(code: ApiErrorCode): string {
  return TITLES[code] ?? 'Algo salió mal';
}

export interface ErrorStateProps {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  retryAfter?: number;
  onRetry?: () => void;
}

export function ErrorState({ code, message, requestId, retryAfter, onRetry }: ErrorStateProps) {
  const router = useRouter();
  const [wait, setWait] = useState(retryAfter ?? 0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  return (
    <div role="alert" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
      <h2 className="font-display text-xl">{errorTitle(code)}</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <Button className="mt-4" disabled={wait > 0} onClick={() => (onRetry ? onRetry() : router.refresh())}>
        {wait > 0 ? `Reintentar en ${wait} s` : 'Reintentar'}
      </Button>
      {requestId && <p className="mt-3 text-[11px] text-muted">ID: {requestId}</p>}
    </div>
  );
}
```

`apps/web/src/components/states/MaintenanceNotice.tsx`:
```tsx
export function MaintenanceNotice() {
  return (
    <div role="status" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
      <p aria-hidden="true" className="text-3xl">
        🛠️
      </p>
      <h2 className="mt-2 font-display text-xl">Brawl Stars está en mantenimiento</h2>
      <p className="mt-2 text-sm text-muted">Supercell está actualizando el juego. Vuelve en un rato.</p>
    </div>
  );
}
```

`apps/web/src/components/states/EmptyState.tsx`:
```tsx
import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="my-6 rounded-card border border-dashed border-border p-6 text-center">
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
```

`apps/web/src/components/states/ApiErrorView.tsx`:
```tsx
import type { ApiError } from '@/lib/api';
import { ErrorState } from './ErrorState';
import { MaintenanceNotice } from './MaintenanceNotice';

/** Los errores de la API se renderizan en línea: en producción Next oculta el mensaje de los errores lanzados. */
export function ApiErrorView({ error }: { error: ApiError }) {
  if (error.code === 'UPSTREAM_MAINTENANCE') return <MaintenanceNotice />;
  return (
    <ErrorState code={error.code} message={error.message} requestId={error.requestId} retryAfter={error.retryAfter} />
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (31 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/states apps/web/test/states.test.tsx
git commit -m "feat(web): estados de stale, error con cuenta regresiva, mantenimiento y vacío

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 6: Búsqueda de tag, recientes y favoritos (localStorage)

**Files:**
- Modify: `packages/shared/package.json` (subpath `./tags`)
- Create: `apps/web/src/lib/local-store.ts`
- Create: `apps/web/src/components/search/TagSearch.tsx`, `RecentSearches.tsx`, `FavoriteButton.tsx`, `RecordVisit.tsx`
- Test: `apps/web/test/search.test.tsx`

**Interfaces:**
- Consumes: `parseTag` desde `@brawlwiki/shared/tags`; `Button` (Task 4).
- Produces:
  - `packages/shared` exporta `"./tags": "./src/tags.ts"`
  - `interface SavedEntry { type: 'player' | 'club'; tag: string; name?: string }`, `MAX_RECENT = 10`
  - `getRecent(): SavedEntry[]`, `addRecent(e: SavedEntry): void` (sin duplicados, el más nuevo primero, reemplaza el nombre, recorta a 10)
  - `getFavorites(): SavedEntry[]`, `isFavorite(e): boolean`, `toggleFavorite(e): boolean` (devuelve el nuevo estado)
  - `TagSearch({ variant?: 'hero' | 'compact'; target?: 'player' | 'club' })` (cliente, `role="search"`): valida con `parseTag`; si es válido guarda el reciente y hace `router.push('/jugador/TAG')` o `'/club/TAG'`; si no, muestra el error en línea con `role="alert"` y `aria-invalid`
  - `RecentSearches()` (cliente): no renderiza nada si está vacío; si no, una lista de links
  - `FavoriteButton({ entry: SavedEntry })` (cliente): `aria-pressed`, con `aria-label` "Guardar en favoritos" o "Quitar de favoritos"
  - `RecordVisit({ entry: SavedEntry })` (cliente): llama a `addRecent(entry)` al montar y renderiza `null`

- [ ] **Step 1: Agregar el subpath al paquete compartido**

En `packages/shared/package.json`, reemplazar `"exports": { ".": "./src/index.ts" }` por:
```json
  "exports": {
    ".": "./src/index.ts",
    "./tags": "./src/tags.ts"
  },
```

- [ ] **Step 2: Escribir el test que falla**

`apps/web/test/search.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { RecentSearches } from '@/components/search/RecentSearches';
import { TagSearch } from '@/components/search/TagSearch';
import { addRecent, getFavorites, getRecent, isFavorite, MAX_RECENT, toggleFavorite } from '@/lib/local-store';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  push.mockClear();
  vi.restoreAllMocks();
});

describe('local-store', () => {
  it('recientes: sin duplicados, el más nuevo primero, máximo 10', () => {
    for (let i = 0; i < 12; i++) addRecent({ type: 'player', tag: `2P${'P'.repeat(i % 3)}${i}` });
    addRecent({ type: 'player', tag: '2PP0' });
    const list = getRecent();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.tag).toBe('2PP0');
    expect(list.filter((e) => e.tag === '2PP0')).toHaveLength(1);
  });

  it('addRecent con nombre reemplaza la entrada anterior', () => {
    addRecent({ type: 'player', tag: '2PP' });
    addRecent({ type: 'player', tag: '2PP', name: 'EzyPlayer' });
    expect(getRecent()).toEqual([{ type: 'player', tag: '2PP', name: 'EzyPlayer' }]);
  });

  it('JSON corrupto o con otra forma → []', () => {
    localStorage.setItem('bw:recent', '{no es json');
    expect(getRecent()).toEqual([]);
    localStorage.setItem('bw:recent', JSON.stringify({ a: 1 }));
    expect(getRecent()).toEqual([]);
    localStorage.setItem('bw:recent', JSON.stringify([{ type: 'player', tag: '2PP' }, { basura: true }]));
    expect(getRecent()).toEqual([{ type: 'player', tag: '2PP' }]);
  });

  it('localStorage no disponible → no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getRecent()).toEqual([]);
    expect(() => addRecent({ type: 'player', tag: '2PP' })).not.toThrow();
    expect(() => toggleFavorite({ type: 'club', tag: '2YPLQ' })).not.toThrow();
  });

  it('favoritos: toggle on/off', () => {
    const club = { type: 'club' as const, tag: '2YPLQ', name: 'Los Cracks' };
    expect(toggleFavorite(club)).toBe(true);
    expect(isFavorite(club)).toBe(true);
    expect(getFavorites()).toEqual([club]);
    expect(toggleFavorite(club)).toBe(false);
    expect(isFavorite(club)).toBe(false);
  });
});

describe('TagSearch', () => {
  it('normaliza " #2pp " y navega al perfil guardando el reciente', async () => {
    render(<TagSearch />);
    await userEvent.type(screen.getByLabelText('Tag del jugador'), ' #2pp ');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith('/jugador/2PP');
    expect(getRecent()[0]).toEqual({ type: 'player', tag: '2PP' });
  });

  it('tag inválido → error en línea y no navega', async () => {
    render(<TagSearch />);
    const input = screen.getByLabelText('Tag del jugador');
    await userEvent.type(input, 'hola!');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('0289PYLQGRJCUV');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });

  it('target club navega a /club/TAG', async () => {
    render(<TagSearch target="club" />);
    await userEvent.type(screen.getByLabelText('Tag del club'), '2yplq');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith('/club/2YPLQ');
  });
});

describe('FavoriteButton y RecentSearches', () => {
  it('FavoriteButton alterna aria-pressed y persiste', async () => {
    render(<FavoriteButton entry={{ type: 'player', tag: '2PP', name: 'EzyPlayer' }} />);
    const button = screen.getByRole('button', { name: 'Guardar en favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(isFavorite({ type: 'player', tag: '2PP' })).toBe(true);
  });

  it('RecentSearches lista los recientes con link y no muestra nada si está vacío', async () => {
    const { container, unmount } = render(<RecentSearches />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    addRecent({ type: 'club', tag: '2YPLQ' });
    addRecent({ type: 'player', tag: '2PP', name: 'EzyPlayer' });
    render(<RecentSearches />);
    await waitFor(() => expect(screen.getByRole('link', { name: /EzyPlayer/ })).toHaveAttribute('href', '/jugador/2PP'));
    expect(screen.getByRole('link', { name: /#2YPLQ/ })).toHaveAttribute('href', '/club/2YPLQ');
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- search`
Expected: FAIL, "Failed to resolve import @/components/search/FavoriteButton".

- [ ] **Step 4: Implementar**

`apps/web/src/lib/local-store.ts`:
```ts
export interface SavedEntry {
  type: 'player' | 'club';
  tag: string;
  name?: string;
}

const RECENT_KEY = 'bw:recent';
const FAVORITES_KEY = 'bw:favorites';
export const MAX_RECENT = 10;

function isEntry(x: unknown): x is SavedEntry {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (e.type === 'player' || e.type === 'club') && typeof e.tag === 'string' && (e.name === undefined || typeof e.name === 'string');
}

function read(key: string): SavedEntry[] {
  try {
    const raw = window.localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: SavedEntry[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la app sigue funcionando sin recordar.
  }
}

const same = (a: SavedEntry, b: SavedEntry) => a.type === b.type && a.tag === b.tag;

export function getRecent(): SavedEntry[] {
  return read(RECENT_KEY);
}

export function addRecent(entry: SavedEntry): void {
  write(RECENT_KEY, [entry, ...getRecent().filter((e) => !same(e, entry))].slice(0, MAX_RECENT));
}

export function getFavorites(): SavedEntry[] {
  return read(FAVORITES_KEY);
}

export function isFavorite(entry: SavedEntry): boolean {
  return getFavorites().some((e) => same(e, entry));
}

export function toggleFavorite(entry: SavedEntry): boolean {
  const list = getFavorites();
  const on = list.some((e) => same(e, entry));
  write(FAVORITES_KEY, on ? list.filter((e) => !same(e, entry)) : [entry, ...list]);
  return !on;
}
```

`apps/web/src/components/search/TagSearch.tsx`:
```tsx
'use client';

import { parseTag } from '@brawlwiki/shared/tags';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { addRecent } from '@/lib/local-store';

const INVALID = 'Ese tag no es válido. Los tags solo usan 0289PYLQGRJCUV (la letra O se toma como cero).';

export function TagSearch({ variant = 'hero', target = 'player' }: { variant?: 'hero' | 'compact'; target?: 'player' | 'club' }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = target === 'player' ? 'Tag del jugador' : 'Tag del club';

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tag = parseTag(value);
    if (!tag) {
      setError(INVALID);
      return;
    }
    setError(null);
    addRecent({ type: target, tag });
    router.push(target === 'player' ? `/jugador/${tag}` : `/club/${tag}`);
  }

  const compact = variant === 'compact';
  return (
    <form role="search" onSubmit={submit} className={compact ? 'flex w-full gap-2' : 'flex flex-col gap-2'}>
      <label htmlFor={id} className={compact ? 'sr-only' : 'text-sm font-semibold text-muted'}>
        {label}
      </label>
      <div className="flex w-full gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#2PP"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted"
        />
        <Button type="submit" variant={compact ? 'secondary' : 'primary'}>
          Buscar
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </form>
  );
}
```

`apps/web/src/components/search/RecentSearches.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getRecent, type SavedEntry } from '@/lib/local-store';

export function RecentSearches() {
  const [items, setItems] = useState<SavedEntry[]>([]);

  useEffect(() => {
    setItems(getRecent());
  }, []);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recientes" className="my-6">
      <h2 id="recientes" className="mb-2 font-display text-sm tracking-wide text-muted">
        RECIENTES
      </h2>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {items.map((e) => (
          <li key={`${e.type}:${e.tag}`}>
            <Link
              href={e.type === 'player' ? `/jugador/${e.tag}` : `/club/${e.tag}`}
              className="flex min-h-11 items-center justify-between gap-3 px-3 hover:bg-surface-2"
            >
              <span className="truncate font-semibold">{e.name ?? `#${e.tag}`}</span>
              <span className="shrink-0 text-xs text-muted">{e.type === 'player' ? 'jugador' : 'club'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/components/search/FavoriteButton.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { isFavorite, type SavedEntry, toggleFavorite } from '@/lib/local-store';

export function FavoriteButton({ entry }: { entry: SavedEntry }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isFavorite(entry));
  }, [entry]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={() => setOn(toggleFavorite(entry))}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-chip text-xl transition-transform active:scale-90 ${on ? 'text-primary' : 'text-muted hover:text-fg'}`}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}
```

`apps/web/src/components/search/RecordVisit.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { addRecent, type SavedEntry } from '@/lib/local-store';

/** Guarda la visita (con nombre) en recientes al abrir un perfil. */
export function RecordVisit({ entry }: { entry: SavedEntry }) {
  useEffect(() => {
    addRecent(entry);
  }, [entry]);
  return null;
}
```

Nota: `FavoriteButton` y `RecordVisit` dependen de `[entry]`. Los padres pasan objetos nuevos en cada render del servidor, pero esos componentes no se vuelven a renderizar en el cliente sin navegación, así que no hay bucles.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm test -w @brawlwiki/shared`
Expected: PASS (41 tests en web; shared sigue en 14/14), typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/package.json apps/web/src/lib/local-store.ts apps/web/src/components/search apps/web/test/search.test.tsx
git commit -m "feat(web): búsqueda de tag con validación, recientes y favoritos en localStorage

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 7: Layout (Header, navegación inferior y superior, Footer con disclaimer)

**Files:**
- Create: `apps/web/src/components/layout/NavLinks.tsx`, `Header.tsx`, `Footer.tsx`
- Modify: `apps/web/src/app/layout.tsx` (archivo completo)
- Test: `apps/web/test/layout.test.tsx`

**Interfaces:**
- Consumes: `TagSearch` (Task 6), `ThemeToggle` (Task 2), `Disclaimer` (Task 4).
- Produces:
  - `NAV_ITEMS`: Inicio `/`, Rankings `/rankings`, Brawlers `/brawlers`, Clubes `/clubes/comparar`. Las tres últimas rutas las construye el **Plan 3**; hasta entonces muestran el 404 del sitio.
  - `isActive(pathname: string, href: string): boolean`: `/` solo exacto; Clubes también cubre `/club/...`; el resto usa el prefijo
  - `NavLinks({ variant: 'bottom' | 'top' })` (cliente, `usePathname`). `bottom` es la barra fija de móvil (`md:hidden`, `aria-label="Navegación inferior"`) y `top` la barra de escritorio (`hidden md:block`, `aria-label="Navegación principal"`). El link activo lleva `aria-current="page"`.
  - `Header()`: logo que en móvil dice "BW" y desde `md` dice "BRAWLWIKI", con `aria-label="BrawlWiki, inicio"`; además navegación superior, `TagSearch` compacto y `ThemeToggle`
  - `Footer()`: `Disclaimer` más la línea de créditos
  - `RootLayout`: link "Saltar al contenido", `Header`, `<main id="contenido">`, `Footer` y `NavLinks variant="bottom"`

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/layout.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { isActive, NavLinks } from '@/components/layout/NavLinks';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('navegación', () => {
  it('isActive', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/jugador/2PP', '/')).toBe(false);
    expect(isActive('/rankings', '/rankings')).toBe(true);
    expect(isActive('/brawlers/16000000', '/brawlers')).toBe(true);
    expect(isActive('/club/2YPLQ', '/clubes/comparar')).toBe(true);
    expect(isActive('/rankingsx', '/rankings')).toBe(false);
  });

  it('NavLinks inferior marca el link activo', () => {
    pathname = '/rankings';
    render(<NavLinks variant="bottom" />);
    const nav = screen.getByRole('navigation', { name: 'Navegación inferior' });
    expect(within(nav).getByRole('link', { name: /Rankings/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Inicio/ })).not.toHaveAttribute('aria-current');
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
  });
});

describe('Header y Footer', () => {
  it('Header tiene logo al inicio, búsqueda y cambio de tema; Footer muestra el disclaimer', () => {
    pathname = '/';
    render(
      <>
        <Header />
        <Footer />
      </>,
    );
    expect(screen.getByRole('link', { name: 'BrawlWiki, inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- layout`
Expected: FAIL, "Failed to resolve import @/components/layout/Footer".

- [ ] **Step 3: Implementar**

`apps/web/src/components/layout/NavLinks.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/rankings', label: 'Rankings', icon: '🏆' },
  { href: '/brawlers', label: 'Brawlers', icon: '🥊' },
  { href: '/clubes/comparar', label: 'Clubes', icon: '🛡️' },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/clubes/comparar') return pathname.startsWith('/clubes') || pathname.startsWith('/club/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: 'bottom' | 'top' }) {
  const pathname = usePathname() ?? '/';

  if (variant === 'bottom') {
    return (
      <nav
        aria-label="Navegación inferior"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-bold text-primary' : 'text-muted'}`}
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Navegación principal" className="hidden md:block">
      <ul className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-chip px-3 text-sm font-semibold ${active ? 'bg-surface-2 text-primary' : 'text-muted hover:text-fg'}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`apps/web/src/components/layout/Header.tsx`:
```tsx
import Link from 'next/link';
import { TagSearch } from '@/components/search/TagSearch';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NavLinks } from './NavLinks';

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 md:gap-4 md:px-6">
        <Link href="/" aria-label="BrawlWiki, inicio" className="shrink-0 font-display text-xl tracking-wide text-primary">
          <span className="md:hidden">BW</span>
          <span className="hidden md:inline">BRAWLWIKI</span>
        </Link>
        <NavLinks variant="top" />
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 md:max-w-sm">
          <TagSearch variant="compact" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

`apps/web/src/components/layout/Footer.tsx`:
```tsx
import { Disclaimer } from '@/components/ui/Disclaimer';

export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 text-center md:px-6 md:pb-10">
      <Disclaimer />
      <p className="mt-1 text-xs text-muted">Fan page hecha por la comunidad. Datos vía la API oficial de Brawl Stars.</p>
    </footer>
  );
}
```

`apps/web/src/app/layout.tsx` (archivo completo):
```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Lilita_One } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { NavLinks } from '@/components/layout/NavLinks';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'BrawlWiki', template: '%s · BrawlWiki' },
  description: 'Stats de jugadores, clubes y rankings de Brawl Stars. Fan page no oficial.',
};

export const viewport: Viewport = { themeColor: '#0b0b0f', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="es" data-theme={theme} className={`${lilita.variable} ${inter.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary-fill focus:px-3 focus:py-2 focus:text-on-primary"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="mx-auto w-full max-w-5xl px-4 md:px-6">
          {children}
        </main>
        <Footer />
        <NavLinks variant="bottom" />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Correr los tests y el build, y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (44 tests acumulados), typecheck limpio y build OK.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout apps/web/src/app/layout.tsx apps/web/test/layout.test.tsx
git commit -m "feat(web): layout mobile-first con navegación inferior, header con búsqueda y footer con disclaimer

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 8: Inicio (búsqueda, recientes, eventos) + 404 y error del sitio

**Files:**
- Create: `apps/web/src/lib/modes.ts`
- Create: `apps/web/src/components/events/EventCard.tsx`, `EventRotation.tsx`, `EventsSkeleton.tsx`
- Modify: `apps/web/src/app/page.tsx` (archivo completo)
- Create: `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`
- Test: `apps/web/test/home.test.tsx`

**Interfaces:**
- Consumes: `getEventRotation` (Task 3), `attempt` (Task 3), `ApiErrorView`, `StaleBadge`, `EmptyState`, `ErrorState` (Task 5), `GameImage`, `Skeleton`, `ButtonLink` (Task 4), `TagSearch`, `RecentSearches` (Task 6), `timeLeft` (Task 1), `EventSlot` de shared.
- Produces:
  - `modeName(key: string): string`: nombre en español para las claves conocidas; si no la conoce, separa el camelCase y pone mayúscula inicial (`"newMode"` da `"New Mode"`)
  - `EventCard({ slot: EventSlot; now: number })`: `<article>` con `h3` (modo), el nombre del mapa y "Termina en X" (o "Terminado")
  - `EventRotation()` (Server Component async): error, vacío o grilla de `EventCard`, más `StaleBadge`
  - `EventsSkeleton()`
  - `/`: sección hero con `h1` "Busca tu perfil" y `TagSearch` hero, `RecentSearches` y la sección "Eventos ahora" con `<Suspense fallback={<EventsSkeleton/>}>`
  - `app/not-found.tsx`: 404 del sitio ("No encontramos esta página" + botón al inicio)
  - `app/error.tsx` (cliente, `{ error, retry }`): `ErrorState` con code `INTERNAL`, `requestId = error.digest` y `onRetry = retry`

- [ ] **Step 1: Escribir el test que falla**

`apps/web/test/home.test.tsx`:
```tsx
import type { EventSlot } from '@brawlwiki/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventCard } from '@/components/events/EventCard';
import { modeName } from '@/lib/modes';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const slot: EventSlot = {
  slotId: 1,
  startTime: '2026-09-29T08:00:00.000Z',
  endTime: '2026-09-29T15:00:00.000Z',
  mode: { name: 'gemGrab', imageUrl: null },
  map: { id: 15000026, name: 'Hard Rock Mine', imageUrl: 'https://cdn.brawlify.com/maps/regular/15000026.png' },
};

describe('modos', () => {
  it('traduce modos conocidos y formatea los desconocidos', () => {
    expect(modeName('gemGrab')).toBe('Atrapagemas');
    expect(modeName('brawlBall')).toBe('Balón Brawl');
    expect(modeName('newMode')).toBe('New Mode');
  });
});

describe('EventCard', () => {
  it('muestra modo, mapa, imagen y tiempo restante', () => {
    render(<EventCard slot={slot} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Atrapagemas' })).toBeInTheDocument();
    expect(screen.getByText('Hard Rock Mine')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa Hard Rock Mine' })).toBeInTheDocument();
    expect(screen.getByText('Termina en 3 h')).toBeInTheDocument();
  });

  it('evento vencido → "Terminado"; mapa sin nombre → "Mapa desconocido"', () => {
    render(
      <EventCard
        slot={{ ...slot, endTime: '2026-09-29T11:00:00.000Z', map: { id: null, name: null, imageUrl: null } }}
        now={NOW}
      />,
    );
    expect(screen.getByText('Terminado')).toBeInTheDocument();
    expect(screen.getByText('Mapa desconocido')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- home`
Expected: FAIL, "Failed to resolve import @/components/events/EventCard".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/modes.ts`:
```ts
const MODE_NAMES: Record<string, string> = {
  gemGrab: 'Atrapagemas',
  brawlBall: 'Balón Brawl',
  heist: 'Atraco',
  bounty: 'Caza estelar',
  knockout: 'Noqueo',
  hotZone: 'Zona restringida',
  wipeout: 'Eliminación',
  duels: 'Duelos',
  soloShowdown: 'Supervivencia',
  duoShowdown: 'Supervivencia a dúo',
  trioShowdown: 'Supervivencia a trío',
  basketBrawl: 'Básquet Brawl',
  volleyBrawl: 'Vóley Brawl',
  payload: 'Carga',
  siege: 'Asedio',
  bossFight: 'Pelea contra el jefe',
  roboRumble: 'Robo Rumble',
  bigGame: 'Gran cacería',
  hunters: 'Cazadores',
  unknown: 'Modo desconocido',
};

export function modeName(key: string): string {
  return MODE_NAMES[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}
```

`apps/web/src/components/events/EventCard.tsx`:
```tsx
import type { EventSlot } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { timeLeft } from '@/lib/format';
import { modeName } from '@/lib/modes';

export function EventCard({ slot, now }: { slot: EventSlot; now: number }) {
  const map = slot.map.name ?? 'Mapa desconocido';
  const left = timeLeft(slot.endTime, now);
  return (
    <article className="flex items-center gap-3 rounded-card border border-border bg-surface p-2">
      <GameImage src={slot.map.imageUrl} alt={`Mapa ${map}`} size={56} fallbackText={map} className="rounded-chip object-cover" />
      <div className="min-w-0">
        <h3 className="truncate font-display text-base">{modeName(slot.mode.name)}</h3>
        <p className="truncate text-sm">{map}</p>
        <p className="text-xs text-muted">{left === 'terminado' ? 'Terminado' : `Termina en ${left}`}</p>
      </div>
    </article>
  );
}
```

`apps/web/src/components/events/EventsSkeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export function EventsSkeleton() {
  return (
    <div role="status" aria-label="Cargando eventos" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[74px]" />
      ))}
    </div>
  );
}
```

`apps/web/src/components/events/EventRotation.tsx`:
```tsx
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getEventRotation } from '@/lib/queries';
import { EventCard } from './EventCard';

export async function EventRotation() {
  const r = await attempt(getEventRotation());
  if (!r.ok) return <ApiErrorView error={r.error} />;
  const { data, meta } = r.value;
  if (data.length === 0) return <EmptyState title="No hay eventos activos" />;
  const now = Date.now();
  return (
    <>
      <StaleBadge meta={meta} />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((slot) => (
          <li key={`${slot.slotId}-${slot.startTime}`}>
            <EventCard slot={slot} now={now} />
          </li>
        ))}
      </ul>
    </>
  );
}
```

`apps/web/src/app/page.tsx` (archivo completo):
```tsx
import { Suspense } from 'react';
import { EventRotation } from '@/components/events/EventRotation';
import { EventsSkeleton } from '@/components/events/EventsSkeleton';
import { RecentSearches } from '@/components/search/RecentSearches';
import { TagSearch } from '@/components/search/TagSearch';

export default function HomePage() {
  return (
    <>
      <section className="mx-auto mt-6 max-w-xl rounded-card border border-border bg-surface p-5">
        <h1 className="text-center font-display text-3xl">Busca tu perfil</h1>
        <p className="mb-4 mt-1 text-center text-sm text-muted">
          Escribe tu tag de Brawl Stars. Lo encuentras en el juego, debajo de tu nombre.
        </p>
        <TagSearch variant="hero" />
      </section>
      <div className="mx-auto max-w-xl">
        <RecentSearches />
      </div>
      <section aria-labelledby="eventos" className="my-8">
        <h2 id="eventos" className="mb-3 font-display text-xl">
          Eventos ahora
        </h2>
        <Suspense fallback={<EventsSkeleton />}>
          <EventRotation />
        </Suspense>
      </section>
    </>
  );
}
```

`apps/web/src/app/not-found.tsx`:
```tsx
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-md text-center">
      <p className="font-display text-5xl text-primary">404</p>
      <h1 className="mt-2 font-display text-2xl">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-muted">Puede que el link esté mal o que la sección todavía no exista.</p>
      <ButtonLink href="/" className="mt-6">
        Volver al inicio
      </ButtonLink>
    </div>
  );
}
```

`apps/web/src/app/error.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/states/ErrorState';

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      code="INTERNAL"
      message="Ocurrió un error inesperado al mostrar esta página."
      requestId={error.digest}
      onRetry={retry}
    />
  );
}
```

- [ ] **Step 4: Correr los tests y el build, y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected: PASS (47 tests acumulados), typecheck limpio y build OK. Si `next typegen` o `tsc` rechazan la firma de `error.tsx`, consultar `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`. En 16.3 recibe `{ error, retry }`.

- [ ] **Step 5: Verificación manual rápida (opcional pero recomendada)**

Run, en dos terminales: `SUPERCELL_MOCK=1 npm run dev:api` y `npm run dev:web`. Abrir `http://localhost:3000`.
Expected: se ve el hero, dos eventos de los fixtures (Atrapagemas y Balón Brawl) y el disclaimer al pie. En móvil (DevTools a 375px) aparece la barra inferior. Detener ambos procesos al terminar.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/modes.ts apps/web/src/components/events apps/web/src/app apps/web/test/home.test.tsx
git commit -m "feat(web): página de inicio con búsqueda, recientes y rotación de eventos; 404 y error del sitio

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 9: Componentes del perfil de jugador (header, stats, brawlers)

**Files:**
- Create: `apps/web/src/lib/brawlers.ts`, `apps/web/src/lib/search-params.ts`
- Create: `apps/web/src/components/brawler/BrawlerTile.tsx`, `BrawlerGrid.tsx`
- Create: `apps/web/src/components/player/PlayerHeader.tsx`, `PlayerStats.tsx`
- Create: `apps/web/test/fixtures.ts`
- Test: `apps/web/test/player.test.tsx`

**Interfaces:**
- Consumes: `Player`, `PlayerBrawler` de shared; `GameImage`, `Card`, `AnimatedNumber` (Task 4); `FavoriteButton` (Task 6); `formatNumber`, `displayName` (Task 1).
- Produces:
  - `BRAWLER_ORDERS = ['trofeos', 'poder', 'nombre']`, `type BrawlerOrder`, `parseOrder(v: string | undefined): BrawlerOrder` (`'trofeos'` por defecto)
  - `sortBrawlers(list, order)`: copia sin mutar. `trofeos` es descendente y desempata por nombre; `poder` es descendente, luego por trofeos y luego por nombre; `nombre` es ascendente con `localeCompare('es')`.
  - `first(v: string | string[] | undefined): string | undefined`
  - `PLAYER_TABS = ['resumen', 'brawlers', 'partidas']`, `type PlayerTab`, `parseTab(v): PlayerTab` (`'resumen'` por defecto)
  - `tileBackground(color: string | null): string` (sin rareza usa el neutro `#3a3a4a`)
  - `BrawlerTile({ brawler })`: `<article aria-label="Nombre, N trofeos, poder P[, Rareza]">`. El texto va siempre en una barra sólida debajo del arte, nunca encima de la imagen.
  - `BrawlerGrid({ brawlers, order, basePath })`: `basePath` **ya incluye un query string** (por ejemplo `/jugador/2PP?tab=brawlers`) y los links de orden agregan `&orden=X`. Incluye `<nav aria-label="Ordenar brawlers">` y la grilla de 4, 5, 6 u 8 columnas según el ancho.
  - `PlayerHeader({ player })`: `h1` con `truncate`, `#TAG · Nivel N · <link al club>` (o "· Sin club") y `FavoriteButton`
  - `PlayerStats({ player })`: trofeos (`AnimatedNumber`), máximo, victorias 3vs3/solo/dúo y la cantidad de brawlers
  - `test/fixtures.ts`: `PLAYER: Player` (EzyPlayer, 4 brawlers) y `brawler(overrides?): PlayerBrawler`

- [ ] **Step 1: Escribir los fixtures de test y el test que falla**

`apps/web/test/fixtures.ts`:
```ts
import type { Player, PlayerBrawler } from '@brawlwiki/shared';

export function brawler(overrides: Partial<PlayerBrawler> = {}): PlayerBrawler {
  return {
    id: 16000000,
    name: 'SHELLY',
    power: 11,
    rank: 30,
    trophies: 900,
    highestTrophies: 950,
    gadgets: [],
    starPowers: [],
    gears: [],
    imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000000.png',
    rarity: null,
    class: null,
    ...overrides,
  };
}

export const PLAYER: Player = {
  tag: '2PP',
  name: 'EzyPlayer',
  nameColor: null,
  icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
  trophies: 42310,
  highestTrophies: 43002,
  expLevel: 187,
  victories: { trio: 3412, duo: 300, solo: 612 },
  club: { tag: '2YPLQ', name: 'Los Cracks' },
  brawlers: [
    brawler({ id: 16000002, name: 'BULL', trophies: 1000, power: 11, rarity: { name: 'Rare', color: '#68fd58' } }),
    brawler({ id: 16000000, name: 'SHELLY', trophies: 900, power: 11 }),
    brawler({ id: 16000001, name: 'COLT', trophies: 750, power: 9 }),
    brawler({ id: 16000003, name: 'BROCK', trophies: 500, power: 7 }),
  ],
};
```

`apps/web/test/player.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrawlerGrid } from '@/components/brawler/BrawlerGrid';
import { BrawlerTile, tileBackground } from '@/components/brawler/BrawlerTile';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerStats } from '@/components/player/PlayerStats';
import { parseOrder, sortBrawlers } from '@/lib/brawlers';
import { first, parseTab } from '@/lib/search-params';
import { brawler, PLAYER } from './fixtures';

describe('orden y parámetros', () => {
  it('sortBrawlers por trofeos, poder y nombre sin mutar', () => {
    const list = [
      brawler({ name: 'COLT', trophies: 750, power: 11 }),
      brawler({ name: 'BULL', trophies: 1000, power: 9 }),
      brawler({ name: 'ASH', trophies: 750, power: 11 }),
    ];
    expect(sortBrawlers(list, 'trofeos').map((b) => b.name)).toEqual(['BULL', 'ASH', 'COLT']);
    expect(sortBrawlers(list, 'poder').map((b) => b.name)).toEqual(['ASH', 'COLT', 'BULL']);
    expect(sortBrawlers(list, 'nombre').map((b) => b.name)).toEqual(['ASH', 'BULL', 'COLT']);
    expect(list[0]!.name).toBe('COLT');
  });

  it('parseOrder, parseTab y first con valores por defecto', () => {
    expect(parseOrder(undefined)).toBe('trofeos');
    expect(parseOrder('poder')).toBe('poder');
    expect(parseOrder('hack')).toBe('trofeos');
    expect(parseTab('partidas')).toBe('partidas');
    expect(parseTab('x')).toBe('resumen');
    expect(first(['a', 'b'])).toBe('a');
    expect(first(undefined)).toBeUndefined();
  });
});

describe('BrawlerTile y BrawlerGrid', () => {
  it('tile con nombre en formato título, rareza en el aria-label y fondo neutro sin rareza', () => {
    render(<BrawlerTile brawler={PLAYER.brawlers[0]!} />);
    expect(screen.getByRole('article', { name: 'Bull, 1,000 trofeos, poder 11, Rare' })).toBeInTheDocument();
    expect(screen.getByText('Bull')).toBeInTheDocument();
    expect(tileBackground(null)).toContain('#3a3a4a');
    expect(tileBackground('#68fd58')).toContain('#68fd58');
  });

  it('grid ordenada con links de orden', () => {
    render(<BrawlerGrid brawlers={PLAYER.brawlers} order="nombre" basePath="/jugador/2PP?tab=brawlers" />);
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')?.split(',')[0]);
    expect(names).toEqual(['Brock', 'Bull', 'Colt', 'Shelly']);
    const nav = screen.getByRole('navigation', { name: 'Ordenar brawlers' });
    expect(within(nav).getByRole('link', { name: 'Nombre' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('link', { name: 'Poder' })).toHaveAttribute('href', '/jugador/2PP?tab=brawlers&orden=poder');
  });
});

describe('PlayerHeader y PlayerStats', () => {
  it('header con nombre truncable, tag, nivel y club', () => {
    render(<PlayerHeader player={PLAYER} />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'EzyPlayer' });
    expect(h1).toHaveClass('truncate');
    expect(screen.getByText(/#2PP · Nivel 187/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
  });

  it('header sin club', () => {
    render(<PlayerHeader player={{ ...PLAYER, club: null }} />);
    expect(screen.getByText(/Sin club/)).toBeInTheDocument();
  });

  it('stats formateadas', () => {
    render(<PlayerStats player={PLAYER} />);
    expect(screen.getByText('42,310', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('43,002')).toBeInTheDocument();
    expect(screen.getByText('3,412')).toBeInTheDocument();
    expect(screen.getByText('4 brawlers desbloqueados')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- player`
Expected: FAIL, "Failed to resolve import @/components/brawler/BrawlerGrid".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/brawlers.ts`:
```ts
import type { PlayerBrawler } from '@brawlwiki/shared';

export const BRAWLER_ORDERS = ['trofeos', 'poder', 'nombre'] as const;
export type BrawlerOrder = (typeof BRAWLER_ORDERS)[number];

export function parseOrder(value: string | undefined): BrawlerOrder {
  return (BRAWLER_ORDERS as readonly string[]).includes(value ?? '') ? (value as BrawlerOrder) : 'trofeos';
}

const byName = (a: PlayerBrawler, b: PlayerBrawler) => a.name.localeCompare(b.name, 'es');

export function sortBrawlers(list: PlayerBrawler[], order: BrawlerOrder): PlayerBrawler[] {
  const copy = [...list];
  if (order === 'nombre') return copy.sort(byName);
  if (order === 'poder') return copy.sort((a, b) => b.power - a.power || b.trophies - a.trophies || byName(a, b));
  return copy.sort((a, b) => b.trophies - a.trophies || byName(a, b));
}
```

`apps/web/src/lib/search-params.ts`:
```ts
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const PLAYER_TABS = ['resumen', 'brawlers', 'partidas'] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number];

export function parseTab(value: string | undefined): PlayerTab {
  return (PLAYER_TABS as readonly string[]).includes(value ?? '') ? (value as PlayerTab) : 'resumen';
}
```

`apps/web/src/components/brawler/BrawlerTile.tsx`:
```tsx
import type { PlayerBrawler } from '@brawlwiki/shared';
import { GameImage } from '@/components/ui/GameImage';
import { displayName, formatNumber } from '@/lib/format';

const NEUTRAL = '#3a3a4a';

/** Arte sobre un fondo radial del color de rareza; la base oscura se mantiene en ambos temas, como una carta del juego. */
export function tileBackground(color: string | null): string {
  const c = color ?? NEUTRAL;
  return `radial-gradient(circle at 50% 35%, ${c} 0%, color-mix(in srgb, ${c} 30%, #0b0b0f) 75%)`;
}

export function BrawlerTile({ brawler }: { brawler: PlayerBrawler }) {
  const name = displayName(brawler.name);
  const color = brawler.rarity?.color ?? null;
  const label = [name, `${formatNumber(brawler.trophies)} trofeos`, `poder ${brawler.power}`, brawler.rarity?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      aria-label={label}
      className="overflow-hidden rounded-card border border-border bg-surface transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <div className="relative flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
        <GameImage src={brawler.imageUrl} alt={name} size={96} fallbackText={name} className="h-[85%] w-auto object-contain" />
        <span className="absolute right-1 top-1 rounded-chip bg-[#0b0b0f]/80 px-1.5 text-[10px] font-bold text-[#f2f2f5]">
          P{brawler.power}
        </span>
      </div>
      <div aria-hidden="true" className="h-[3px]" style={{ background: color ?? NEUTRAL }} />
      <div className="flex items-center justify-between gap-1 px-2 py-1">
        <span className="truncate text-xs font-bold">{name}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted">{formatNumber(brawler.trophies)}</span>
      </div>
    </article>
  );
}
```

`apps/web/src/components/brawler/BrawlerGrid.tsx`:
```tsx
import type { PlayerBrawler } from '@brawlwiki/shared';
import Link from 'next/link';
import { BRAWLER_ORDERS, type BrawlerOrder, sortBrawlers } from '@/lib/brawlers';
import { BrawlerTile } from './BrawlerTile';

const ORDER_LABELS: Record<BrawlerOrder, string> = { trofeos: 'Trofeos', poder: 'Poder', nombre: 'Nombre' };

/** `basePath` ya incluye un query string (ej. "/jugador/2PP?tab=brawlers"). */
export function BrawlerGrid({ brawlers, order, basePath }: { brawlers: PlayerBrawler[]; order: BrawlerOrder; basePath: string }) {
  const sorted = sortBrawlers(brawlers, order);
  return (
    <section aria-labelledby="brawlers-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="brawlers-title" className="font-display text-lg">
          Brawlers <span className="text-sm text-muted">({brawlers.length})</span>
        </h2>
        <nav aria-label="Ordenar brawlers" className="flex gap-1">
          {BRAWLER_ORDERS.map((o) => (
            <Link
              key={o}
              href={`${basePath}&orden=${o}`}
              scroll={false}
              aria-current={o === order ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-chip px-3 text-xs font-semibold ${o === order ? 'bg-surface-2 text-primary' : 'text-muted hover:text-fg'}`}
            >
              {ORDER_LABELS[o]}
            </Link>
          ))}
        </nav>
      </div>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {sorted.map((b) => (
          <li key={b.id}>
            <BrawlerTile brawler={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/components/player/PlayerHeader.tsx`:
```tsx
import type { Player } from '@brawlwiki/shared';
import Link from 'next/link';
import { FavoriteButton } from '@/components/search/FavoriteButton';
import { GameImage } from '@/components/ui/GameImage';

export function PlayerHeader({ player }: { player: Player }) {
  return (
    <header className="mt-4 flex items-center gap-3">
      <GameImage
        src={player.icon.imageUrl}
        alt={`Ícono de ${player.name}`}
        size={56}
        fallbackText={player.name}
        className="rounded-card"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl">{player.name}</h1>
        <p className="truncate text-sm text-muted">
          #{player.tag} · Nivel {player.expLevel}
          {player.club ? (
            <>
              {' · '}
              <Link href={`/club/${player.club.tag}`} className="text-fg underline-offset-2 hover:underline">
                {player.club.name}
              </Link>
            </>
          ) : (
            ' · Sin club'
          )}
        </p>
      </div>
      <FavoriteButton entry={{ type: 'player', tag: player.tag, name: player.name }} />
    </header>
  );
}
```

`apps/web/src/components/player/PlayerStats.tsx`:
```tsx
import type { Player } from '@brawlwiki/shared';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/format';

export function PlayerStats({ player }: { player: Player }) {
  const stats = [
    { label: 'Victorias 3vs3', value: player.victories.trio },
    { label: 'Victorias solo', value: player.victories.solo },
    { label: 'Victorias dúo', value: player.victories.duo },
  ];
  return (
    <section aria-label="Estadísticas">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-wider text-muted">TROFEOS</p>
          <AnimatedNumber value={player.trophies} className="font-display text-3xl text-primary" />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold tracking-wider text-muted">MÁXIMO</p>
          <p className="font-display text-xl tabular-nums">{formatNumber(player.highestTrophies)}</p>
        </div>
      </Card>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{s.label}</dt>
            <dd className="font-display text-lg tabular-nums">{formatNumber(s.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-muted">{player.brawlers.length} brawlers desbloqueados</p>
    </section>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (54 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/brawlers.ts apps/web/src/lib/search-params.ts apps/web/src/components/brawler apps/web/src/components/player apps/web/test/fixtures.ts apps/web/test/player.test.tsx
git commit -m "feat(web): componentes del perfil (header, stats, tarjetas y grilla de brawlers ordenable)

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 10: Battle log (resumen, filas expandibles, skeleton y sección con streaming)

**Files:**
- Create: `apps/web/src/lib/battles.ts`
- Create: `apps/web/src/components/player/BattleRow.tsx`, `BattleLog.tsx`, `BattleLogSkeleton.tsx`, `BattleLogSection.tsx`
- Modify: `apps/web/test/fixtures.ts` (archivo completo: suma `battlePlayer` y `BATTLES`)
- Test: `apps/web/test/battles.test.tsx`

**Interfaces:**
- Consumes: `Battle`, `BattlePlayer` de shared; `Chip`, `GameImage` (Task 4); `EmptyState`, `StaleBadge`, `ApiErrorView` (Task 5); `getBattleLog`, `attempt` (Task 3); `modeName` (Task 8); `displayName`, `signed`, `timeAgo` (Task 1).
- Produces:
  - `type OutcomeTone = 'win' | 'loss' | 'neutral'`, `interface Outcome { label: string; tone: OutcomeTone }`
  - `battleOutcome(b: Battle): Outcome`:
    - `victory` da "Victoria"/`win`, `defeat` da "Derrota"/`loss` y `draw` da "Empate"/`neutral`;
    - sin `result` pero con `rank` (showdown) da "Puesto N", con el tono según el signo de `trophyChange`;
    - sin nada de lo anterior da "Sin resultado"/`neutral`.
  - `interface BattleSummary { total; wins; losses; draws; winRate: number | null; trophyDelta }` y `summarizeBattles(battles: Battle[]): BattleSummary`:
    - `winRate` se redondea a entero y sale solo de las partidas con `result`; si no hay ninguna, es `null` (nunca `NaN`);
    - `trophyDelta` suma `trophyChange ?? 0`.
  - `findPlayer(b: Battle, tag: string): BattlePlayer | null`
  - `BattleRow({ battle, playerTag, now })` (cliente):
    - el `<button aria-expanded aria-controls>` resume la partida: brawler usado, modo, "mapa · hace X", `Chip` con el resultado en texto y trofeos con signo;
    - el panel (`hidden` mientras está cerrado) muestra los equipos ("Equipo del jugador" / "Rivales", o "Jugadores" si todos los equipos son de 1), el link a cada jugador menos el propio, el chip "Estelar" y la duración;
    - tolera el centinela del mapper (`id: 0`, `name: '?'`, `imageUrl: null`) y lo muestra como "Brawler desconocido".
  - `BattleLog({ battles, playerTag, now })`: `EmptyState` "Sin partidas recientes" si está vacío; si no, `h2` "Últimas N partidas", un resumen (`% de victorias` o "—", victorias, trofeos) y la lista de `BattleRow`.
  - `BattleLogSkeleton()`: `role="status"`, `aria-label="Cargando partidas"`
  - `BattleLogSection({ tag })` (Server Component async): `attempt(getBattleLog(tag))` → `ApiErrorView` o `StaleBadge` + `BattleLog`. Así, si falla solo el battle log, el error queda dentro de su `<Suspense>` y el resto del perfil se ve igual (spec, sección 7).
  - `test/fixtures.ts`: `battlePlayer(tag, name, brawlerId, brawlerName, power?)` y `BATTLES: Battle[]`, con la misma forma que devuelve la API para el battle log de fixtures de `#2PP` (gemGrab victoria +8, brawlBall derrota −6, soloShowdown puesto 2 +9, duelo amistoso victoria sin trofeos ni mapa).

- [ ] **Step 1: Ampliar los fixtures de test y escribir el test que falla**

`apps/web/test/fixtures.ts` (archivo completo):
```ts
import type { Battle, BattlePlayer, Player, PlayerBrawler } from '@brawlwiki/shared';

export function brawler(overrides: Partial<PlayerBrawler> = {}): PlayerBrawler {
  return {
    id: 16000000,
    name: 'SHELLY',
    power: 11,
    rank: 30,
    trophies: 900,
    highestTrophies: 950,
    gadgets: [],
    starPowers: [],
    gears: [],
    imageUrl: 'https://cdn.brawlify.com/brawlers/borderless/16000000.png',
    rarity: null,
    class: null,
    ...overrides,
  };
}

export const PLAYER: Player = {
  tag: '2PP',
  name: 'EzyPlayer',
  nameColor: null,
  icon: { id: 28000000, imageUrl: 'https://cdn.brawlify.com/profile-icons/regular/28000000.png' },
  trophies: 42310,
  highestTrophies: 43002,
  expLevel: 187,
  victories: { trio: 3412, duo: 300, solo: 612 },
  club: { tag: '2YPLQ', name: 'Los Cracks' },
  brawlers: [
    brawler({ id: 16000002, name: 'BULL', trophies: 1000, power: 11, rarity: { name: 'Rare', color: '#68fd58' } }),
    brawler({ id: 16000000, name: 'SHELLY', trophies: 900, power: 11 }),
    brawler({ id: 16000001, name: 'COLT', trophies: 750, power: 9 }),
    brawler({ id: 16000003, name: 'BROCK', trophies: 500, power: 7 }),
  ],
};

export function battlePlayer(tag: string, name: string, brawlerId: number, brawlerName: string, power = 11): BattlePlayer {
  return {
    tag,
    name,
    brawler: {
      id: brawlerId,
      name: brawlerName,
      power,
      trophies: 900,
      imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`,
    },
  };
}

const mapRef = (id: number, name: string) => ({ id, name, imageUrl: `https://cdn.brawlify.com/maps/regular/${id}.png` });

/** Misma forma que devuelve la API para el battle log de fixtures de #2PP. */
export const BATTLES: Battle[] = [
  {
    battleTime: '2026-09-29T11:55:00.000Z',
    mode: 'gemGrab',
    type: 'ranked',
    map: mapRef(15000026, 'Hard Rock Mine'),
    result: 'victory',
    rank: null,
    trophyChange: 8,
    durationSeconds: 121,
    starPlayerTag: '2PP',
    teams: [
      [
        battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY'),
        battlePlayer('8QU', 'SinClub', 16000001, 'COLT', 3),
        battlePlayer('Y2YY', 'Aliado', 16000002, 'BULL', 9),
      ],
      [
        battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10),
        battlePlayer('QQQ', 'Rival2', 16000000, 'SHELLY'),
        battlePlayer('LLQ', 'Rival3', 16000001, 'COLT'),
      ],
    ],
  },
  {
    battleTime: '2026-09-29T11:43:00.000Z',
    mode: 'brawlBall',
    type: 'ranked',
    map: mapRef(15000048, 'Super Beach'),
    result: 'defeat',
    rank: null,
    trophyChange: -6,
    durationSeconds: 150,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000002, 'BULL')], [battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10)]],
  },
  {
    battleTime: '2026-09-29T11:35:00.000Z',
    mode: 'soloShowdown',
    type: 'ranked',
    map: mapRef(15000011, 'Skull Creek'),
    result: null,
    rank: 2,
    trophyChange: 9,
    durationSeconds: null,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY')], [battlePlayer('QQQ', 'Rival2', 16000001, 'COLT')]],
  },
  {
    battleTime: '2026-09-29T11:20:00.000Z',
    mode: 'duels',
    type: 'friendly',
    map: { id: null, name: null, imageUrl: null },
    result: 'victory',
    rank: null,
    trophyChange: null,
    durationSeconds: 95,
    starPlayerTag: null,
    teams: [[battlePlayer('2PP', 'EzyPlayer', 16000000, 'SHELLY')], [battlePlayer('PPP', 'Rival1', 16000003, 'BROCK', 10)]],
  },
];
```

`apps/web/test/battles.test.tsx`:
```tsx
import type { Battle } from '@brawlwiki/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BattleLog } from '@/components/player/BattleLog';
import { BattleRow } from '@/components/player/BattleRow';
import { battleOutcome, findPlayer, summarizeBattles } from '@/lib/battles';
import { BATTLES } from './fixtures';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const [gem, ball, showdown, duel] = BATTLES as [Battle, Battle, Battle, Battle];

describe('battles', () => {
  it('battleOutcome comunica el resultado con texto', () => {
    expect(battleOutcome(gem)).toEqual({ label: 'Victoria', tone: 'win' });
    expect(battleOutcome(ball)).toEqual({ label: 'Derrota', tone: 'loss' });
    expect(battleOutcome({ ...gem, result: 'draw' })).toEqual({ label: 'Empate', tone: 'neutral' });
    expect(battleOutcome(showdown)).toEqual({ label: 'Puesto 2', tone: 'win' });
    expect(battleOutcome({ ...showdown, rank: 7, trophyChange: -4 })).toEqual({ label: 'Puesto 7', tone: 'loss' });
    expect(battleOutcome({ ...gem, result: null })).toEqual({ label: 'Sin resultado', tone: 'neutral' });
  });

  it('summarizeBattles cuenta solo partidas con resultado y suma los trofeos', () => {
    expect(summarizeBattles(BATTLES)).toEqual({ total: 4, wins: 2, losses: 1, draws: 0, winRate: 67, trophyDelta: 11 });
    expect(findPlayer(gem, '8QU')?.name).toBe('SinClub');
    expect(findPlayer(gem, '9999')).toBeNull();
  });

  it('summarizeBattles([]) no produce NaN', () => {
    expect(summarizeBattles([])).toEqual({ total: 0, wins: 0, losses: 0, draws: 0, winRate: null, trophyDelta: 0 });
  });
});

describe('BattleRow', () => {
  it('cerrada: modo, mapa, hace cuánto, resultado en texto y trofeos', () => {
    render(<BattleRow battle={gem} playerTag="2PP" now={NOW} />);
    const button = screen.getByRole('button', { name: /Atrapagemas/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Hard Rock Mine · hace 5 min');
    expect(button).toHaveTextContent('Victoria');
    expect(button).toHaveTextContent('+8');
    expect(screen.queryByRole('link', { name: 'SinClub' })).not.toBeInTheDocument();
  });

  it('se expande con el teclado y muestra equipos, links y jugador estelar', async () => {
    const user = userEvent.setup();
    render(<BattleRow battle={gem} playerTag="2PP" now={NOW} />);
    await user.tab();
    const button = screen.getByRole('button', { name: /Atrapagemas/ });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Equipo del jugador' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rivales' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SinClub' })).toHaveAttribute('href', '/jugador/8QU');
    expect(screen.queryByRole('link', { name: 'EzyPlayer' })).not.toBeInTheDocument();
    expect(screen.getByText('Estelar')).toBeInTheDocument();
    expect(screen.getByText('Duración: 2:01')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('tolera el brawler centinela del mapper (id 0, "?", sin imagen)', async () => {
    const unknown = { tag: '2PP', name: 'EzyPlayer', brawler: { id: 0, name: '?', power: 0, trophies: 0, imageUrl: null } };
    render(<BattleRow battle={{ ...duel, teams: [[unknown]] }} playerTag="2PP" now={NOW} />);
    const button = screen.getByRole('button', { name: /Duelos/ });
    expect(button).toHaveTextContent('Mapa desconocido');
    await userEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Jugadores' })).toBeInTheDocument();
    const images = screen.getAllByRole('img', { name: 'Brawler desconocido' });
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img).toHaveTextContent('?');
  });
});

describe('BattleLog', () => {
  it('vacío → EmptyState, sin porcentajes ni NaN', () => {
    const { container } = render(<BattleLog battles={[]} playerTag="2PP" now={NOW} />);
    expect(screen.getByText('Sin partidas recientes')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('NaN');
    expect(container).not.toHaveTextContent('%');
  });

  it('con partidas → resumen y una fila expandible por partida', () => {
    render(<BattleLog battles={BATTLES} playerTag="2PP" now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Últimas 4 partidas' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('+11')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- battles`
Expected: FAIL, "Failed to resolve import @/components/player/BattleLog".

- [ ] **Step 3: Implementar**

`apps/web/src/lib/battles.ts`:
```ts
import type { Battle, BattlePlayer } from '@brawlwiki/shared';

export type OutcomeTone = 'win' | 'loss' | 'neutral';

export interface Outcome {
  label: string;
  tone: OutcomeTone;
}

export function battleOutcome(b: Battle): Outcome {
  if (b.result === 'victory') return { label: 'Victoria', tone: 'win' };
  if (b.result === 'defeat') return { label: 'Derrota', tone: 'loss' };
  if (b.result === 'draw') return { label: 'Empate', tone: 'neutral' };
  if (b.rank !== null) {
    const change = b.trophyChange ?? 0;
    return { label: `Puesto ${b.rank}`, tone: change > 0 ? 'win' : change < 0 ? 'loss' : 'neutral' };
  }
  return { label: 'Sin resultado', tone: 'neutral' };
}

export interface BattleSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  /** Porcentaje entero sobre las partidas con resultado; `null` si no hay ninguna. */
  winRate: number | null;
  trophyDelta: number;
}

export function summarizeBattles(battles: Battle[]): BattleSummary {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let trophyDelta = 0;
  for (const b of battles) {
    if (b.result === 'victory') wins++;
    else if (b.result === 'defeat') losses++;
    else if (b.result === 'draw') draws++;
    trophyDelta += b.trophyChange ?? 0;
  }
  const decided = wins + losses + draws;
  return {
    total: battles.length,
    wins,
    losses,
    draws,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : null,
    trophyDelta,
  };
}

export function findPlayer(b: Battle, tag: string): BattlePlayer | null {
  for (const team of b.teams) {
    for (const p of team) if (p.tag === tag) return p;
  }
  return null;
}
```

`apps/web/src/components/player/BattleRow.tsx`:
```tsx
'use client';

import type { Battle, BattlePlayer } from '@brawlwiki/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { GameImage } from '@/components/ui/GameImage';
import { battleOutcome, findPlayer } from '@/lib/battles';
import { displayName, signed, timeAgo } from '@/lib/format';
import { modeName } from '@/lib/modes';

/** El mapper manda { id: 0, name: '?', imageUrl: null } cuando Supercell no trae el brawler. */
function brawlerName(p: BattlePlayer): string {
  return p.brawler.id === 0 ? 'Brawler desconocido' : displayName(p.brawler.name);
}

function BrawlerIcon({ player, size }: { player: BattlePlayer; size: number }) {
  return (
    <GameImage
      src={player.brawler.imageUrl}
      alt={brawlerName(player)}
      size={size}
      fallbackText={player.brawler.id === 0 ? '?' : displayName(player.brawler.name)}
      className="rounded-chip bg-surface-2"
    />
  );
}

function duration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function teamTitle(team: BattlePlayer[], index: number, total: number, playerTag: string): string {
  if (total === 2) return team.some((p) => p.tag === playerTag) ? 'Equipo del jugador' : 'Rivales';
  return `Equipo ${index + 1}`;
}

interface TeamProps {
  title: string;
  players: BattlePlayer[];
  playerTag: string;
  starTag: string | null;
}

function Team({ title, players, playerTag, starTag }: TeamProps) {
  return (
    <div className="mt-2 first:mt-0">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <ul>
        {players.map((p, i) => (
          <li key={`${p.tag}-${i}`} className="flex min-h-11 items-center gap-2">
            <BrawlerIcon player={p} size={32} />
            <span className="min-w-0 flex-1">
              {p.tag === playerTag ? (
                <span className="block truncate text-sm font-semibold">{p.name}</span>
              ) : (
                <Link
                  href={`/jugador/${p.tag}`}
                  className="block truncate text-sm font-semibold underline-offset-2 hover:underline"
                >
                  {p.name}
                </Link>
              )}
              <span className="block truncate text-xs text-muted">
                {brawlerName(p)}
                {p.brawler.id !== 0 && ` · P${p.brawler.power}`}
              </span>
            </span>
            {p.tag === starTag && (
              <Chip tone="accent">
                <span aria-hidden="true">⭐ </span>
                Estelar
              </Chip>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BattleRow({ battle, playerTag, now }: { battle: Battle; playerTag: string; now: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const outcome = battleOutcome(battle);
  const self = findPlayer(battle, playerTag);
  const map = battle.map.name ?? 'Mapa desconocido';
  const solo = battle.teams.every((t) => t.length <= 1);
  const change = battle.trophyChange;

  return (
    <div className="rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-3 rounded-card p-2 text-left hover:bg-surface-2"
      >
        {self && <BrawlerIcon player={self} size={40} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{modeName(battle.mode)}</span>
          <span className="block truncate text-xs text-muted">
            {map} · {timeAgo(battle.battleTime, now)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Chip tone={outcome.tone}>{outcome.label}</Chip>
          {change !== null && (
            <span
              className={`text-xs font-bold tabular-nums ${change > 0 ? 'text-win' : change < 0 ? 'text-loss' : 'text-muted'}`}
            >
              {signed(change)}
              <span aria-hidden="true"> 🏆</span>
              <span className="sr-only"> trofeos</span>
            </span>
          )}
        </span>
        <span aria-hidden="true" className={`text-xs text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-border p-2">
        {solo ? (
          <Team title="Jugadores" players={battle.teams.flat()} playerTag={playerTag} starTag={battle.starPlayerTag} />
        ) : (
          battle.teams.map((team, i) => (
            <Team
              key={i}
              title={teamTitle(team, i, battle.teams.length, playerTag)}
              players={team}
              playerTag={playerTag}
              starTag={battle.starPlayerTag}
            />
          ))
        )}
        {battle.durationSeconds !== null && (
          <p className="mt-2 text-xs text-muted">Duración: {duration(battle.durationSeconds)}</p>
        )}
      </div>
    </div>
  );
}
```

Nota: el panel se renderiza siempre (con `hidden` mientras está cerrado) para que `aria-controls` apunte a un elemento que existe. Tailwind v4 aplica `display: none` a `[hidden]` en su preflight.

`apps/web/src/components/player/BattleLog.tsx`:
```tsx
import type { Battle } from '@brawlwiki/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { summarizeBattles } from '@/lib/battles';
import { signed } from '@/lib/format';
import { BattleRow } from './BattleRow';

export function BattleLog({ battles, playerTag, now }: { battles: Battle[]; playerTag: string; now: number }) {
  if (battles.length === 0) {
    return (
      <EmptyState title="Sin partidas recientes">
        Supercell solo muestra las últimas 25 partidas. Si el jugador no ha jugado en un tiempo, la lista queda vacía.
      </EmptyState>
    );
  }

  const s = summarizeBattles(battles);
  const deltaTone = s.trophyDelta > 0 ? 'text-win' : s.trophyDelta < 0 ? 'text-loss' : '';
  const stats = [
    { label: '% de victorias', value: s.winRate === null ? '—' : `${s.winRate}%`, tone: '' },
    { label: 'Victorias', value: String(s.wins), tone: '' },
    { label: 'Trofeos', value: signed(s.trophyDelta), tone: deltaTone },
  ];

  return (
    <section aria-labelledby="partidas-title">
      <h2 id="partidas-title" className="font-display text-lg">
        Últimas {s.total} partidas
      </h2>
      <dl className="my-2 grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <div key={st.label} className="rounded-card bg-surface-2 p-2 text-center">
            <dt className="text-[11px] text-muted">{st.label}</dt>
            <dd className={`font-display text-lg tabular-nums ${st.tone}`}>{st.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-2">
        {battles.map((b, i) => (
          <li key={`${b.battleTime}-${i}`}>
            <BattleRow battle={b} playerTag={playerTag} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/components/player/BattleLogSkeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export function BattleLogSkeleton() {
  return (
    <div role="status" aria-label="Cargando partidas">
      <Skeleton className="h-6 w-48" />
      <div className="my-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[58px]" />
        ))}
      </div>
    </div>
  );
}
```

`apps/web/src/components/player/BattleLogSection.tsx`:
```tsx
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getBattleLog } from '@/lib/queries';
import { BattleLog } from './BattleLog';

/** Va dentro de <Suspense>: si falla solo el battle log, el resto del perfil se ve igual. */
export async function BattleLogSection({ tag }: { tag: string }) {
  const r = await attempt(getBattleLog(tag));
  if (!r.ok) return <ApiErrorView error={r.error} />;
  return (
    <>
      <StaleBadge meta={r.value.meta} />
      <BattleLog battles={r.value.data} playerTag={tag} now={Date.now()} />
    </>
  );
}
```
`BattleLogSection` no tiene test unitario porque depende de `next/headers`. Lo cubren los E2E de la Task 12 (tab Partidas de `2PP` y de `8QU`).

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web`
Expected: PASS (62 tests acumulados), typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/battles.ts apps/web/src/components/player apps/web/test/fixtures.ts apps/web/test/battles.test.tsx
git commit -m "feat(web): battle log con resumen, filas expandibles por teclado y sección en streaming

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 11: Página del perfil de jugador (`/jugador/[tag]`) + imagen OG

**Files:**
- Create: `apps/web/src/lib/player-route.ts`
- Create: `apps/web/src/components/player/PlayerOverview.tsx`, `InvalidTag.tsx`
- Create: `apps/web/src/app/jugador/[tag]/page.tsx`, `loading.tsx`, `not-found.tsx`, `opengraph-image.tsx`
- Create: `apps/web/src/assets/fonts/LilitaOne-Regular.ttf`, `apps/web/src/assets/fonts/OFL.txt` (descargados)
- Test: `apps/web/test/player-page.test.tsx`

**Interfaces:**
- Consumes: `parseTag` de `@brawlwiki/shared/tags`; `getPlayer`, `attempt` (Task 3); `TabItem`, `Tabs`, `ButtonLink`, `Skeleton`, `DISCLAIMER` (Task 4); `ApiErrorView`, `StaleBadge`, `EmptyState` (Task 5); `TagSearch`, `RecordVisit` (Task 6); `PlayerHeader`, `PlayerStats`, `BrawlerTile`, `BrawlerGrid`, `parseOrder`, `sortBrawlers`, `first`, `parseTab`, `PLAYER_TABS`, `PlayerTab` (Task 9); `BattleLogSection`, `BattleLogSkeleton` (Task 10); `formatNumber`, `displayName` (Task 1).
- Produces:
  - `resolveTag(raw: string): string | null`: aplica `decodeURIComponent` (si falla, da `null`) y después `parseTag`. Así `%232pp`, `#2pp` y `2pp` dan `2PP`.
  - `playerTabs(tag: string, active: PlayerTab): TabItem[]`: Resumen va a `/jugador/TAG` y el resto a `/jugador/TAG?tab=X`.
  - `PlayerOverview({ player })`: `h2` "Mejores brawlers" con los 3 de más trofeos (o `EmptyState` "Todavía no tiene brawlers") y links "Ver los N brawlers" y "Ver partidas recientes".
  - `InvalidTag()`: `h1` "Tag inválido", los caracteres válidos, la ayuda de O → 0 y un `TagSearch`.
  - `/jugador/[tag]`:
    - un tag inválido muestra `InvalidTag` sin llamar a la API;
    - un tag no canónico hace `redirect` al canónico y conserva el tab;
    - `NOT_FOUND` llama a `notFound()`, `INVALID_TAG` muestra `InvalidTag` y cualquier otro error, `ApiErrorView`;
    - con datos: `RecordVisit`, `PlayerHeader`, `StaleBadge`, `Tabs` y el contenido del tab. En el tab Partidas, el battle log va en `<Suspense fallback={<BattleLogSkeleton/>}>`.
  - Layout: en móvil, una columna (tabs, stats solo en Resumen y luego el contenido). Desde `lg`, `PlayerStats` va fija a la izquierda y los tabs y el contenido a la derecha (spec, sección 6).
  - `generateMetadata`: el título es `"Nombre (#TAG)"` y la descripción incluye trofeos, cantidad de brawlers y nivel. Si hay error, el título es `"#TAG"`; si el tag es inválido, `"Tag inválido"`.
  - `loading.tsx`: `role="status"`, `aria-label="Cargando perfil"`, con la forma del header, los tabs y las stats.
  - `not-found.tsx`: `h1` "No encontramos ese jugador" + `TagSearch`.
  - `opengraph-image.tsx`: 1200×630 PNG con el nombre, `#TAG · Nivel N`, los trofeos, el top 3 de brawlers (solo texto) y el `DISCLAIMER` al pie. Si hay error o el tag es inválido, una tarjeta genérica de BrawlWiki con el disclaimer.

- [ ] **Step 1: Descargar la fuente para la imagen OG**

`next/og` (Satori) necesita la fuente como archivo; no puede usar `next/font`. Lilita One tiene licencia OFL, que permite redistribuirla si se incluye la licencia.

Run:
```bash
mkdir -p apps/web/src/assets/fonts
curl -fL -o apps/web/src/assets/fonts/LilitaOne-Regular.ttf https://github.com/google/fonts/raw/main/ofl/lilitaone/LilitaOne-Regular.ttf
curl -fL -o apps/web/src/assets/fonts/OFL.txt https://github.com/google/fonts/raw/main/ofl/lilitaone/OFL.txt
ls -l apps/web/src/assets/fonts
```
Expected: `LilitaOne-Regular.ttf` pesa unos 28 KB y `OFL.txt` empieza con "Copyright".

- [ ] **Step 2: Escribir el test que falla**

`apps/web/test/player-page.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvalidTag } from '@/components/player/InvalidTag';
import { PlayerOverview } from '@/components/player/PlayerOverview';
import { playerTabs, resolveTag } from '@/lib/player-route';
import { PLAYER } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('ruta del jugador', () => {
  it('resolveTag normaliza lo que llega por URL y rechaza lo inválido', () => {
    expect(resolveTag('2PP')).toBe('2PP');
    expect(resolveTag('2pp')).toBe('2PP');
    expect(resolveTag('%232PP')).toBe('2PP');
    expect(resolveTag('#2PO')).toBe('2P0');
    expect(resolveTag('HOLA')).toBeNull();
    expect(resolveTag('%E0%A4%A')).toBeNull();
  });

  it('playerTabs arma los links de los tabs y marca el activo', () => {
    expect(playerTabs('2PP', 'partidas')).toEqual([
      { href: '/jugador/2PP', label: 'Resumen', active: false },
      { href: '/jugador/2PP?tab=brawlers', label: 'Brawlers', active: false },
      { href: '/jugador/2PP?tab=partidas', label: 'Partidas', active: true },
    ]);
  });
});

describe('PlayerOverview e InvalidTag', () => {
  it('resumen con los 3 brawlers de más trofeos y links a los tabs', () => {
    render(<PlayerOverview player={PLAYER} />);
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')?.split(',')[0]);
    expect(names).toEqual(['Bull', 'Shelly', 'Colt']);
    expect(screen.getByRole('link', { name: 'Ver los 4 brawlers' })).toHaveAttribute('href', '/jugador/2PP?tab=brawlers');
    expect(screen.getByRole('link', { name: 'Ver partidas recientes' })).toHaveAttribute(
      'href',
      '/jugador/2PP?tab=partidas',
    );
  });

  it('jugador sin brawlers → estado vacío', () => {
    render(<PlayerOverview player={{ ...PLAYER, brawlers: [] }} />);
    expect(screen.getByText('Todavía no tiene brawlers')).toBeInTheDocument();
  });

  it('InvalidTag explica los caracteres válidos y ofrece buscar de nuevo', () => {
    render(<InvalidTag />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeInTheDocument();
    expect(screen.getByText('0289PYLQGRJCUV')).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w @brawlwiki/web -- player-page`
Expected: FAIL, "Failed to resolve import @/components/player/InvalidTag".

- [ ] **Step 4: Implementar los helpers y los componentes**

`apps/web/src/lib/player-route.ts`:
```ts
import { parseTag } from '@brawlwiki/shared/tags';
import type { TabItem } from '@/components/ui/Tabs';
import { PLAYER_TABS, type PlayerTab } from './search-params';

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

const TAB_LABELS: Record<PlayerTab, string> = { resumen: 'Resumen', brawlers: 'Brawlers', partidas: 'Partidas' };

export function playerTabs(tag: string, active: PlayerTab): TabItem[] {
  return PLAYER_TABS.map((t) => ({
    href: t === 'resumen' ? `/jugador/${tag}` : `/jugador/${tag}?tab=${t}`,
    label: TAB_LABELS[t],
    active: t === active,
  }));
}
```

`apps/web/src/components/player/PlayerOverview.tsx`:
```tsx
import type { Player } from '@brawlwiki/shared';
import { BrawlerTile } from '@/components/brawler/BrawlerTile';
import { EmptyState } from '@/components/states/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { sortBrawlers } from '@/lib/brawlers';

export function PlayerOverview({ player }: { player: Player }) {
  const top = sortBrawlers(player.brawlers, 'trofeos').slice(0, 3);
  return (
    <section aria-labelledby="top-title">
      <h2 id="top-title" className="mb-2 font-display text-lg">
        Mejores brawlers
      </h2>
      {top.length === 0 ? (
        <EmptyState title="Todavía no tiene brawlers" />
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {top.map((b) => (
            <li key={b.id}>
              <BrawlerTile brawler={b} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ButtonLink href={`/jugador/${player.tag}?tab=brawlers`} variant="secondary">
          Ver los {player.brawlers.length} brawlers
        </ButtonLink>
        <ButtonLink href={`/jugador/${player.tag}?tab=partidas`} variant="secondary">
          Ver partidas recientes
        </ButtonLink>
      </div>
    </section>
  );
}
```

`apps/web/src/components/player/InvalidTag.tsx`:
```tsx
import { TagSearch } from '@/components/search/TagSearch';

export function InvalidTag() {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">Tag inválido</h1>
      <p className="mt-2 text-sm text-muted">
        Los tags de Brawl Stars solo usan estos caracteres:{' '}
        <strong className="font-mono tracking-wider text-fg">0289PYLQGRJCUV</strong>. Si ves una letra O, en realidad es
        un cero (0).
      </p>
      <div className="mt-4 text-left">
        <TagSearch variant="hero" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -w @brawlwiki/web`
Expected: PASS (67 tests acumulados).

- [ ] **Step 6: Implementar la ruta**

`apps/web/src/app/jugador/[tag]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BrawlerGrid } from '@/components/brawler/BrawlerGrid';
import { BattleLogSection } from '@/components/player/BattleLogSection';
import { BattleLogSkeleton } from '@/components/player/BattleLogSkeleton';
import { InvalidTag } from '@/components/player/InvalidTag';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerOverview } from '@/components/player/PlayerOverview';
import { PlayerStats } from '@/components/player/PlayerStats';
import { RecordVisit } from '@/components/search/RecordVisit';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { Tabs } from '@/components/ui/Tabs';
import { attempt } from '@/lib/attempt';
import { parseOrder } from '@/lib/brawlers';
import { formatNumber } from '@/lib/format';
import { playerTabs, resolveTag } from '@/lib/player-route';
import { getPlayer } from '@/lib/queries';
import { first, parseTab } from '@/lib/search-params';

export async function generateMetadata({ params }: PageProps<'/jugador/[tag]'>): Promise<Metadata> {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return { title: 'Tag inválido' };
  if (tag !== raw) return {}; // la página redirige al tag canónico
  const r = await attempt(getPlayer(tag));
  if (!r.ok) return { title: `#${tag}` };
  const p = r.value.data;
  return {
    title: `${p.name} (#${p.tag})`,
    description: `${formatNumber(p.trophies)} trofeos · ${p.brawlers.length} brawlers · Nivel ${p.expLevel}. Stats de Brawl Stars en BrawlWiki.`,
  };
}

export default async function PlayerPage({ params, searchParams }: PageProps<'/jugador/[tag]'>) {
  const [{ tag: raw }, sp] = await Promise.all([params, searchParams]);
  const tag = resolveTag(raw);
  if (!tag) return <InvalidTag />;

  const tab = parseTab(first(sp.tab));
  if (tag !== raw) redirect(playerTabs(tag, tab).find((t) => t.active)!.href);

  const r = await attempt(getPlayer(tag));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND') notFound();
    if (r.error.code === 'INVALID_TAG') return <InvalidTag />;
    return <ApiErrorView error={r.error} />;
  }

  const { data: player, meta } = r.value;
  const order = parseOrder(first(sp.orden));

  return (
    <>
      <RecordVisit entry={{ type: 'player', tag: player.tag, name: player.name }} />
      <PlayerHeader player={player} />
      <StaleBadge meta={meta} />
      <div className="mt-2 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-0">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <Tabs label="Secciones del perfil" items={playerTabs(player.tag, tab)} />
        </div>
        <aside
          aria-label="Resumen del jugador"
          className={`lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-3 ${tab === 'resumen' ? '' : 'hidden lg:block'}`}
        >
          <PlayerStats player={player} />
        </aside>
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          {tab === 'resumen' && <PlayerOverview player={player} />}
          {tab === 'brawlers' && (
            <BrawlerGrid brawlers={player.brawlers} order={order} basePath={`/jugador/${player.tag}?tab=brawlers`} />
          )}
          {tab === 'partidas' && (
            <Suspense fallback={<BattleLogSkeleton />}>
              <BattleLogSection tag={player.tag} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
```
Notas:
- El orden del DOM es tabs, stats y contenido, que es el orden de lectura en móvil. Desde `lg`, la grilla manda las stats a la columna izquierda (ocupan dos filas) y los tabs y el contenido a la derecha.
- `getPlayer` está envuelto en `cache()` (Task 3): `generateMetadata` y la página comparten una sola llamada a Express por request.
- `redirect()` y `notFound()` lanzan excepciones internas de Next. Por eso van **fuera** de `attempt()`, que solo atrapa `ApiError` y relanza todo lo demás.

`apps/web/src/app/jugador/[tag]/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando perfil" className="mt-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-card" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      <Skeleton className="mt-5 h-[52px]" />
      <Skeleton className="mt-4 h-[76px]" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px]" />
        ))}
      </div>
    </div>
  );
}
```

`apps/web/src/app/jugador/[tag]/not-found.tsx`:
```tsx
import { TagSearch } from '@/components/search/TagSearch';

export default function PlayerNotFound() {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese jugador</h1>
      <p className="mb-4 mt-2 text-sm text-muted">
        Revisa el tag en tu perfil dentro del juego. Si la cuenta es nueva, puede tardar un rato en aparecer.
      </p>
      <div className="text-left">
        <TagSearch variant="hero" />
      </div>
    </div>
  );
}
```

`apps/web/src/app/jugador/[tag]/opengraph-image.tsx`:
```tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/components/ui/Disclaimer';
import { attempt } from '@/lib/attempt';
import { sortBrawlers } from '@/lib/brawlers';
import { displayName, formatNumber } from '@/lib/format';
import { resolveTag } from '@/lib/player-route';
import { getPlayer } from '@/lib/queries';

export const alt = 'Perfil de jugador de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// `next dev` y `next start` corren con cwd = apps/web.
const lilita = readFile(join(process.cwd(), 'src/assets/fonts/LilitaOne-Regular.ttf'));

const C = { bg: '#0b0b0f', surface: '#15151c', border: '#2c2c3a', fg: '#f2f2f5', muted: '#a1a1b3', primary: '#ffc61a' };
const DISPLAY = 'Lilita One';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getPlayer(tag)) : null;
  const player = r?.ok ? r.value.data : null;
  const top = player ? sortBrawlers(player.brawlers, 'trofeos').slice(0, 3) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          color: C.fg,
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 36, color: C.primary }}>BRAWLWIKI</div>
        {player ? (
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, marginTop: 28 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: DISPLAY,
                fontSize: 84,
                lineHeight: 1.1,
                maxWidth: 1072,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {player.name}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: C.muted, marginTop: 8 }}>
              {`#${player.tag} · Nivel ${player.expLevel}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 96, color: C.primary }}>{formatNumber(player.trophies)}</span>
              <span style={{ fontSize: 32, color: C.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {top.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: C.surface,
                    border: `2px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 20px',
                    marginRight: 16,
                  }}
                >
                  <span style={{ fontFamily: DISPLAY, fontSize: 30 }}>{displayName(b.name)}</span>
                  <span style={{ fontSize: 24, color: C.muted }}>{`${formatNumber(b.trophies)} trofeos`}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', fontFamily: DISPLAY, fontSize: 72 }}>
            Stats de Brawl Stars
          </div>
        )}
        <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{DISCLAIMER}</div>
      </div>
    ),
    { ...size, fonts: [{ name: DISPLAY, data: await lilita, style: 'normal', weight: 400 }] },
  );
}
```
Notas de la imagen OG:
- Satori exige `display: 'flex'` en todo `div` que tenga más de un hijo. Los textos compuestos van como un único template string para que cuenten como un solo hijo.
- Los brawlers van solo como texto: una imagen remota del CDN que falle rompería toda la imagen OG.
- El texto que no usa Lilita One sale con la fuente por defecto de `next/og`. Para dudas de la API, ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`.

- [ ] **Step 7: Correr tests, typecheck y build**

Run: `npm test -w @brawlwiki/web && npm run typecheck -w @brawlwiki/web && npm run build -w @brawlwiki/web`
Expected:
- PASS (67 tests).
- Typecheck limpio: `next typegen` genera `PageProps<'/jugador/[tag]'>`.
- Build OK, con `/jugador/[tag]` y `/jugador/[tag]/opengraph-image` como rutas dinámicas (ƒ).

- [ ] **Step 8: Verificación manual**

Run, en dos terminales: `SUPERCELL_MOCK=1 npm run dev:api` y `npm run dev:web`. Después:
```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/jugador/2PP/opengraph-image
```
Expected:
- `curl` imprime `200 image/png`.
- En el navegador:
  - `/jugador/2PP`: EzyPlayer, 42,310 trofeos, top 3 Bull, Shelly y Colt, y el club "Los Cracks".
  - `/jugador/2pp?tab=partidas` redirige a `/jugador/2PP?tab=partidas` y muestra 4 partidas; la primera se expande con Enter.
  - `/jugador/8QU?tab=partidas` muestra "Sin partidas recientes".
  - `/jugador/HOLA` muestra "Tag inválido" y `/jugador/9Q9Q`, "No encontramos ese jugador".
  - `/jugador/LLLL` muestra el aviso de mantenimiento.
  - En DevTools a 1280px, las stats quedan a la izquierda y los tabs a la derecha.
- Al terminar, detener ambos procesos.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/player-route.ts apps/web/src/components/player apps/web/src/app/jugador apps/web/src/assets apps/web/test/player-page.test.tsx
git commit -m "feat(web): perfil de jugador con tabs en la URL, battle log en streaming, 404, tag inválido e imagen OG

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

### Task 12: E2E con Playwright + axe, scripts y README

**Files:**
- Create: `apps/web/src/components/layout/HydrationFlag.tsx`
- Modify: `apps/web/src/app/layout.tsx` (agrega `<HydrationFlag />`)
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/fixtures.ts`, `mock.setup.ts`, `home.spec.ts`, `player.spec.ts`, `scenarios.spec.ts`, `theme.spec.ts`, `cooldown.spec.ts` (todos en `apps/web/e2e/`)
- Modify: `apps/web/package.json` (script `e2e` y devDependencies), `package.json` de la raíz (script `e2e`), `README.md` (archivo completo)

**Interfaces:**
- Consumes: todas las páginas de las Tasks 7 a 11; la API en modo fixtures (`SUPERCELL_MOCK=1`) con los tags `2PP`, `8QU`, `LLLL`, `GGGG` y `RRRR`.
- Produces:
  - `HydrationFlag()` (cliente): pone `data-hydrated="true"` en `<html>` cuando React terminó de hidratar. Los E2E la esperan antes de interactuar, porque un clic antes de la hidratación se pierde (y el formulario de búsqueda haría un GET nativo).
  - `npm run e2e` (raíz) → `playwright test` en `apps/web`. Playwright levanta su propia API con fixtures en `:4100` y un build de producción de la web en `:3100`, así que no choca con `npm run dev` (`:4000` y `:3000`).
  - `e2e/fixtures.ts`:
    - `test`: el `page` de cada test manda un `X-Forwarded-For` propio (IP en `198.18.0.0/15`). Next lo reenvía tal cual y Express le da a cada test su propio cupo de 60 req/min. Esto aísla los tests entre sí y además prueba de punta a punta el contrato del reenvío de IP.
    - `gotoReady(page, path)`, `expectAccessible(page)` (cero violaciones *serious* o *critical* de axe en WCAG 2.0/2.1 A y AA) y `expectNoHorizontalScroll(page)`.
  - Proyectos de Playwright:
    - `setup`: verifica que la API de E2E corre con fixtures y **nunca** con la key real;
    - `main`: todo menos el cooldown, en el dispositivo Pixel 7;
    - `cooldown`: corre **después** de `main`. El tag `RRRR` activa un cooldown de 10 s en **todo** el proceso de la API, y si corriera en paralelo, los demás tests recibirían `UPSTREAM_RATE_LIMITED`.

- [ ] **Step 1: Instalar Playwright y axe, y agregar los scripts**

Run:
```bash
npm install -D -w @brawlwiki/web @playwright/test@^1.63.0 @axe-core/playwright@^4.13.0
npx playwright install chromium
```
Expected: el install termina sin errores y Chromium queda descargado.

En `apps/web/package.json`, agregar a `scripts`:
```json
    "e2e": "playwright test"
```
En el `package.json` de la raíz, agregar a `scripts`:
```json
    "e2e": "npm run e2e -w @brawlwiki/web"
```

- [ ] **Step 2: Marca de hidratación**

`apps/web/src/components/layout/HydrationFlag.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

/** Marca <html data-hydrated> cuando React terminó de hidratar; los E2E la esperan antes de interactuar. */
export function HydrationFlag() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
```

En `apps/web/src/app/layout.tsx`, agregar el import junto a los otros de `@/components/layout`:
```tsx
import { HydrationFlag } from '@/components/layout/HydrationFlag';
```
y, dentro de `<body>`, justo después de `<NavLinks variant="bottom" />`:
```tsx
        <HydrationFlag />
```

- [ ] **Step 3: Configuración de Playwright y helpers**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: WEB_URL, locale: 'es-MX', trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /mock\.setup\.ts/ },
    {
      name: 'main',
      testIgnore: /cooldown\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    {
      // RRRR activa un cooldown global de 10 s en la API: corre al final, solo.
      name: 'cooldown',
      testMatch: /cooldown\.spec\.ts/,
      dependencies: ['main'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start -w @brawlwiki/api',
      cwd: '../..',
      url: `${API_URL}/health`,
      // Las variables del entorno tienen prioridad sobre apps/api/.env (process.loadEnvFile no las pisa).
      env: { SUPERCELL_MOCK: '1', HOST: '127.0.0.1', PORT: String(API_PORT), LOG_LEVEL: 'warn', REDIS_URL: '' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: WEB_URL,
      env: { API_INTERNAL_URL: API_URL, NEXT_PUBLIC_SITE_URL: WEB_URL },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
```

`apps/web/e2e/fixtures.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/** IP distinta por test (rango 198.18.0.0/15): cada test tiene su propio cupo de 60 req/min en Express. */
function ipFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `198.18.${(h >>> 8) & 255}.${(h & 255) || 1}`;
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ipFor(testInfo.testId) });
    await use(page);
  },
});

export { expect };

/** Navega y espera la hidratación: antes de eso, un clic se pierde. */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}
```

`apps/web/e2e/mock.setup.ts`:
```ts
import { expect, test } from '@playwright/test';

test('la API de E2E corre con fixtures (nunca con la key real)', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:4100/api/v1/health');
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { supercell: string } };
  expect(body.data.supercell).toBe('mock');
});
```

- [ ] **Step 4: Escribir los specs**

`apps/web/e2e/home.spec.ts`:
```ts
import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('inicio: hero, eventos de los fixtures, navegación inferior y disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Busca tu perfil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atrapagemas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balón Brawl' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toBeVisible();
  await expect(page.getByText('Este material es no oficial y no está avalado por Supercell.')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test('tag inválido: error en línea y no navega', async ({ page }) => {
  await gotoReady(page, '/');
  const main = page.getByRole('main');
  await main.getByLabel('Tag del jugador').fill('hola!');
  await main.getByRole('button', { name: 'Buscar' }).click();
  await expect(main.getByRole('alert')).toContainText('0289PYLQGRJCUV');
  await expect(page).toHaveURL('/');
});
```

`apps/web/e2e/player.spec.ts`:
```ts
import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('buscar → perfil → Partidas → expandir partida → ir a otro jugador', async ({ page }) => {
  await gotoReady(page, '/');
  const main = page.getByRole('main');
  await main.getByLabel('Tag del jugador').fill(' #2pp ');
  await main.getByRole('button', { name: 'Buscar' }).click();

  await expect(page).toHaveURL('/jugador/2PP');
  await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible();
  await expect(page.getByText('43,002')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('navigation', { name: 'Secciones del perfil' }).getByRole('link', { name: 'Partidas' }).click();
  await expect(page).toHaveURL('/jugador/2PP?tab=partidas');
  await expect(page.getByRole('heading', { name: 'Últimas 4 partidas' })).toBeVisible();

  const row = page.getByRole('button', { name: /Atrapagemas/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expectAccessible(page);

  await page.getByRole('link', { name: 'SinClub' }).click();
  await expect(page).toHaveURL('/jugador/8QU');
  await expect(page.getByRole('heading', { level: 1, name: 'SinClub' })).toBeVisible();
  await expect(page.getByRole('main').getByText(/· Sin club/)).toBeVisible();
});

test('jugador sin partidas → estado vacío y ningún NaN', async ({ page }) => {
  await page.goto('/jugador/8QU?tab=partidas');
  await expect(page.getByText('Sin partidas recientes')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
  await expectAccessible(page);
});

test('tab Brawlers ordena por nombre y el orden queda en la URL', async ({ page }) => {
  await page.goto('/jugador/2PP?tab=brawlers');
  await page.getByRole('navigation', { name: 'Ordenar brawlers' }).getByRole('link', { name: 'Nombre' }).click();
  await expect(page).toHaveURL('/jugador/2PP?tab=brawlers&orden=nombre');
  await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', /^Brock,/);
  await expectAccessible(page);
});

test('a 375px no hay scroll horizontal en ningún tab', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const query of ['', '?tab=brawlers', '?tab=partidas']) {
    await page.goto(`/jugador/2PP${query}`);
    await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test('favoritos sobreviven a la recarga y la visita queda en recientes', async ({ page }) => {
  await gotoReady(page, '/jugador/2PP');
  await page.getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: /EzyPlayer/ })).toHaveAttribute('href', '/jugador/2PP');
});
```

`apps/web/e2e/scenarios.spec.ts`:
```ts
import { expect, expectAccessible, test } from './fixtures';

test('#LLLL → aviso de mantenimiento', async ({ page }) => {
  await page.goto('/jugador/LLLL');
  await expect(page.getByRole('heading', { name: 'Brawl Stars está en mantenimiento' })).toBeVisible();
  await expectAccessible(page);
});

test('tag válido que no existe → 404 del jugador', async ({ page }) => {
  await page.goto('/jugador/9Q9Q');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese jugador' })).toBeVisible();
  await expectAccessible(page);
});

test('tag inválido por URL → página de tag inválido', async ({ page }) => {
  await page.goto('/jugador/HOLA');
  await expect(page.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeVisible();
});

test('tag no canónico redirige y conserva el tab', async ({ page }) => {
  await page.goto('/jugador/2pp?tab=partidas');
  await expect(page).toHaveURL('/jugador/2PP?tab=partidas');
});

test('#GGGG (Supercell tarda 4 s): primero el skeleton, después el perfil', async ({ page }) => {
  // Depende de que la API arranque con la caché vacía; Playwright levanta una API nueva en cada corrida.
  await page.goto('/jugador/GGGG', { waitUntil: 'commit' });
  await expect(page.getByRole('status', { name: 'Cargando perfil' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible({ timeout: 10_000 });
});

test('la imagen OG del perfil responde un PNG', async ({ page, request }) => {
  await page.goto('/jugador/2PP');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
  const res = await request.get(og!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});
```

`apps/web/e2e/theme.spec.ts`:
```ts
import { expect, expectAccessible, gotoReady, test } from './fixtures';

test('el tema claro persiste al recargar y la página sigue accesible', async ({ page }) => {
  await gotoReady(page, '/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expectAccessible(page);
});
```

`apps/web/e2e/cooldown.spec.ts`:
```ts
import { expect, expectAccessible, test } from './fixtures';

// Proyecto `cooldown`: corre después de todos los demás (ver playwright.config.ts).
test('#RRRR → "Vas muy rápido" con cuenta regresiva', async ({ page }) => {
  await page.goto('/jugador/RRRR');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Vas muy rápido');
  await expect(alert.getByRole('button', { name: /Reintentar en \d+ s/ })).toBeDisabled();
  await expectAccessible(page);
});
```

- [ ] **Step 5: Correr los E2E y verificar que pasan**

Run: `npm run e2e`
Expected: 16 tests pasan (1 de setup, 14 de main y 1 de cooldown). El build de producción tarda la primera vez.

Si un test falla:
- Si `expectAccessible` reporta contraste (`color-contrast`), corregir el token o la clase del componente. **No** desactivar la regla.
- Si `toHaveURL` falla después de una búsqueda, confirmar que el test usa `gotoReady`: el clic llegó antes de la hidratación.
- Si `mock.setup.ts` falla con un `supercell` distinto de `mock`, **detenerse**: la API de E2E está usando la key real. Revisar el `env` del `webServer`.
- Para ver qué pasó: `npx playwright show-report apps/web/playwright-report`.

- [ ] **Step 6: README**

`README.md` (archivo completo):
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
npm run dev                              # API en :4000 y web en http://localhost:3000
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

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web juntas (también `npm run dev:api` y `npm run dev:web`) |
| `npm test` | Tests unitarios de todos los paquetes |
| `npm run typecheck` | Chequeo de tipos |
| `npm run e2e` | Playwright + axe. Levanta su propia API con fixtures (:4100) y un build de producción de la web (:3100). La primera vez: `npx playwright install chromium` |
| `npm run meta:import -w @brawlwiki/api -- <ruta absoluta a brawlers.json>` | Actualiza rareza y clase de los brawlers. El JSON se descarga desde el navegador en https://api.brawlify.com/v1/brawlers |

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`.
````

- [ ] **Step 7: Verificación final de todo el repo**

Run:
```bash
npm test && npm run typecheck && npm run e2e
git grep -nE '^SUPERCELL_API_KEY=.+' -- apps/api/.env.example
git status --short
```
Expected:
- Tests, typecheck y E2E en verde.
- `git grep` **no imprime nada**: la key real nunca debe quedar en `.env.example`, que está trackeado.
- `git status` no muestra ningún `.env`, `.env.local`, `playwright-report/` ni `test-results/`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/layout/HydrationFlag.tsx apps/web/src/app/layout.tsx apps/web/playwright.config.ts apps/web/e2e apps/web/package.json package.json package-lock.json README.md
git commit -m "test(web): E2E con Playwright y axe contra la API en modo fixtures; README de desarrollo

Co-Authored-By: <tu modelo> <noreply@anthropic.com>"
```

---

## Pendiente para el Plan 3

Surgió al revisar el Plan 1 y no entra en este plan:
- **Rankings:** Supercell responde `200` con una lista vacía para una región inválida (por ejemplo `ZZ`). La página de rankings tiene que mostrar `EmptyState` en ese caso, no un error.
- **Clubes:** `opengraph-image.tsx` de `/club/[tag]` puede reutilizar la estructura y la fuente de la imagen OG del jugador (Task 11).
- **E2E:** los specs nuevos (comparar clubes, rankings cambiando de región) van en el proyecto `main`. Cualquier spec que use `RRRR` va en `cooldown`.
