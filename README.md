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
| `/` | 93 | 100 | 2.74 s | 0.008 | 204 ms |
| `/jugador/2PP` | 93 | 100 | 2.87 s | 0.000 | 150 ms |
| `/club/2YPLQ` | 86 | 100 | 2.75 s | 0.005 | 397 ms |
| `/rankings` | 94 | 100 | 2.92 s | 0.000 | 149 ms |
| `/brawlers` | 95 | 100 | 2.84 s | 0.000 | 71 ms |

Medido el 2026-10-03. El TBT varía bastante entre corridas en esta máquina (por ejemplo, `/club/2YPLQ` midió 105 ms el 2026-10-02).

El objetivo de LCP (< 1.5 s) **no se cumple** en `/` ni en `/jugador/2PP` con el throttling móvil simulado de Lighthouse. El TTFB es de unos 25 ms y el FCP/LCP sin throttling ronda los 0.5–0.7 s; el LCP simulado lo domina el costo del bundle de JavaScript. Es una brecha conocida de la v1, pendiente de decisión.

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`.
