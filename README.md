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
