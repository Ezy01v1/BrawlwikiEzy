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

`npm run e2e` deja en `apps/web/.next` un build con `NEXT_PUBLIC_SITE_URL=http://localhost:3100`; antes de desplegar, correr `npm run build -w @brawlwiki/web` con las variables de producción.
| `npm run meta:import -w @brawlwiki/api -- <ruta absoluta a brawlers.json>` | Actualiza rareza y clase de los brawlers. El JSON se descarga desde el navegador en https://api.brawlify.com/v1/brawlers |

Contrato de la API: `GET /api/v1/openapi.json`. Diseño completo: `docs/superpowers/specs/2026-09-29-brawlwiki-v1-design.md`.
