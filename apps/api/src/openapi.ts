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
    request?: { params?: z.ZodObject<z.ZodRawShape>; query?: z.ZodObject<z.ZodRawShape> },
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
