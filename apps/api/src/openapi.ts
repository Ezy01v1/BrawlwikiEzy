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
  CommunityTierListSchema,
  envelopeSchema,
  EventSlotSchema,
  FavoriteKindSchema,
  FavoriteSchema,
  HealthSchema,
  ImportFavoritesBodySchema,
  MeSchema,
  MyTierListSchema,
  PlayerRankingSchema,
  PlayerSchema,
  SaveTierListBodySchema,
  SeasonSchema,
  UserSchema,
} from '@brawlwiki/shared';
import { z } from 'zod';

extendZodWithOpenApi(z);

let cached: ReturnType<OpenApiGeneratorV31['generateDocument']> | undefined;

const SESSION_SECURITY = [{ cookieAuth: [] }];
const ORIGIN_NOTE =
  ' Los métodos que modifican datos exigen una cabecera Origin igual al origen del sitio; si no, 403 FORBIDDEN.';

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Parámetro o cuerpo inválido (INVALID_PARAM o INVALID_TAG)',
  401: 'Sin sesión (UNAUTHENTICATED)',
  403: 'Origin distinto del sitio (FORBIDDEN)',
  404: 'No encontrado (NOT_FOUND)',
  409: 'No hay una temporada activa (NO_ACTIVE_SEASON)',
  429: 'Demasiadas solicitudes (RATE_LIMITED)',
  503: 'Comunidad no disponible: MySQL caído (DB_UNAVAILABLE). Sin DATABASE_URL las rutas de Comunidad no existen y se obtiene el 404 genérico',
};

/** Respuestas de error con el mismo cuerpo que el `default` de la v1. */
function errorResponses(...statuses: number[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        content: { 'application/json': { schema: ApiErrorBodySchema } },
      },
    ]),
  );
}

/** Rutas de Comunidad (cuentas, favoritos y tier list). El documento las incluye siempre; la API solo las monta con DATABASE_URL. */
function registerCommunityPaths(registry: OpenAPIRegistry) {
  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'bw_session',
    description: 'Cookie de sesión bw_session (HttpOnly, SameSite=Lax) que fija el login con Discord.',
  });

  // Los esquemas compartidos se crean al importar @brawlwiki/shared, antes de extendZodWithOpenApi:
  // zod 4 copia los métodos a cada instancia, así que se clonan para que lleven .openapi().
  const register = <T extends z.ZodType>(name: string, schema: T): T => registry.register(name, schema.clone());

  register('User', UserSchema);
  const Me = register('Me', MeSchema);
  const Favorite = register('Favorite', FavoriteSchema);
  const Season = register('Season', SeasonSchema);
  const CommunityTierList = register('CommunityTierList', CommunityTierListSchema);
  const MyTierList = register('MyTierList', MyTierListSchema);
  const SaveTierListBody = register('SaveTierListBody', SaveTierListBodySchema);
  const ImportFavoritesBody = register('ImportFavoritesBody', ImportFavoritesBodySchema);

  const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
  const ok = (description: string, data: z.ZodType) => ({ description, content: json(envelopeSchema(data)) });
  const body = (schema: z.ZodType) => ({ required: true, content: json(schema) });
  const favoriteParams = z.object({
    kind: FavoriteKindSchema.describe('"player" o "club"'),
    tag: z.string().describe('Tag sin #, ej. 2PP'),
  });
  const nameBody = z.object({ name: z.string().min(1).max(64).describe('Nombre a mostrar, 1 a 64 caracteres') });
  const oauthCookie = {
    'Set-Cookie': {
      description: 'Cookie bw_oauth con el state del login (10 min); en modo mock, la cookie bw_session de la sesión',
      schema: { type: 'string' as const },
    },
  };
  const sessionCookie = {
    'Set-Cookie': {
      description: 'Solo si el login tuvo éxito: cookie bw_session de la sesión. Si falla no se fija ninguna sesión',
      schema: { type: 'string' as const },
    },
  };

  registry.registerPath({
    method: 'get',
    path: '/auth/discord',
    summary: 'Inicia el login con Discord',
    description:
      'Redirige (302) a Discord con scope=identify. Con AUTH_MOCK=1 crea la sesión del usuario de prueba y redirige a next.',
    request: {
      query: z.object({
        next: z
          .string()
          .optional()
          .describe('Ruta interna a la que volver; debe empezar con / (no con // ni /\\), si no se usa /'),
      }),
    },
    responses: {
      302: { description: 'Redirección a Discord (o a next en modo mock)', headers: oauthCookie },
      ...errorResponses(503),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/auth/discord/callback',
    summary: 'Cierra el login con Discord',
    description:
      'Valida state, abre la sesión (cookie bw_session) y redirige (302) a next. Si algo falla redirige a next con login=error.',
    request: { query: z.object({ code: z.string().optional(), state: z.string().optional() }) },
    responses: {
      302: { description: 'Redirección a next', headers: sessionCookie },
      ...errorResponses(503),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    summary: 'Cierra la sesión',
    description: `Destruye la sesión y borra la cookie.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    responses: { 204: { description: 'Sesión cerrada' }, ...errorResponses(401, 403, 503) },
  });

  registry.registerPath({
    method: 'get',
    path: '/me',
    summary: 'Usuario de la sesión',
    description: 'Nunca responde 401: sin sesión devuelve { user: null }. No se cachea.',
    responses: { 200: ok('OK', Me), ...errorResponses(503) },
  });

  registry.registerPath({
    method: 'patch',
    path: '/me',
    summary: 'Vincula o quita el tag de jugador',
    description: `Envía { "playerTag": "#TAG" } para vincular o { "playerTag": null } para quitarlo. Devuelve el usuario actualizado.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { body: body(z.object({ playerTag: z.string().nullable() })) },
    responses: { 200: ok('Usuario actualizado', Me), ...errorResponses(400, 401, 403, 503) },
  });

  registry.registerPath({
    method: 'delete',
    path: '/me',
    summary: 'Borra la cuenta',
    description: `Borra el usuario con sus sesiones, favoritos y votos, y limpia la cookie.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    responses: { 204: { description: 'Cuenta borrada' }, ...errorResponses(401, 403, 503) },
  });

  registry.registerPath({
    method: 'get',
    path: '/me/favorites',
    summary: 'Favoritos de la cuenta',
    description: 'En data viene un arreglo (sin objeto envoltorio), el más reciente primero. No se cachea.',
    security: SESSION_SECURITY,
    responses: { 200: ok('OK', z.array(Favorite)), ...errorResponses(401, 503) },
  });

  registry.registerPath({
    method: 'put',
    path: '/me/favorites/{kind}/{tag}',
    summary: 'Agrega un favorito',
    description: `Idempotente: si ya existe no cambia nada.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { params: favoriteParams, body: body(nameBody) },
    responses: { 204: { description: 'Guardado' }, ...errorResponses(400, 401, 403, 503) },
  });

  registry.registerPath({
    method: 'delete',
    path: '/me/favorites/{kind}/{tag}',
    summary: 'Quita un favorito',
    description: `Idempotente: si no existe responde igual.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { params: favoriteParams },
    responses: { 204: { description: 'Quitado' }, ...errorResponses(400, 401, 403, 503) },
  });

  registry.registerPath({
    method: 'post',
    path: '/me/favorites/import',
    summary: 'Importa favoritos del navegador',
    description: `Unión sin pisar lo que ya hay; máximo 100 ítems. Un tag inválido rechaza todo el envío. Devuelve cuántos se agregaron.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { body: body(ImportFavoritesBody) },
    responses: {
      200: ok('Importados', z.object({ imported: z.number().int().describe('Favoritos realmente agregados') })),
      ...errorResponses(400, 401, 403, 503),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/seasons',
    summary: 'Temporadas de la tier list',
    description: 'En data viene un arreglo (sin objeto envoltorio), la más nueva primero. Es público.',
    responses: { 200: ok('OK', z.array(Season)), ...errorResponses(503) },
  });

  registry.registerPath({
    method: 'post',
    path: '/seasons',
    summary: 'Abre una temporada nueva (solo admin)',
    description: `Cierra la temporada activa y abre una nueva. Responde 201 con la temporada misma en data. Quien no es admin, y también quien no tiene sesión, recibe 404 NOT_FOUND para no revelar la ruta.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { body: body(nameBody) },
    responses: { 201: ok('Temporada abierta', Season), ...errorResponses(400, 403, 404, 503) },
  });

  registry.registerPath({
    method: 'get',
    path: '/tierlist',
    summary: 'Tier list de la comunidad',
    description:
      'Agregado de una temporada (la activa si no se indica season). Solo cuentan los usuarios que ubicaron al menos 10 brawlers. ' +
      'La letra se deriva del promedio redondeado a 2 decimales, el mismo average que devuelve la API (por ejemplo 4.495 se redondea a 4.50 y es S; 4.49 es A): S desde 4.5, A desde 3.5, B desde 2.5, C desde 1.5 y D por debajo. ' +
      'Con menos de 5 votos el brawler lleva tier: null ("Pocos votos"). Sin temporadas, o si season no existe, responde 404 NOT_FOUND. Se cachea 5 min (activa) o 24 h (cerrada).',
    request: { query: z.object({ season: z.string().optional().describe('Id de la temporada; defecto: la activa') }) },
    responses: { 200: ok('OK', CommunityTierList), ...errorResponses(400, 404, 503) },
  });

  registry.registerPath({
    method: 'get',
    path: '/tierlist/me',
    summary: 'Mi tier list de la temporada activa',
    description: 'Sin temporada activa responde 409 NO_ACTIVE_SEASON. No se cachea.',
    security: SESSION_SECURITY,
    responses: { 200: ok('OK', MyTierList), ...errorResponses(401, 409, 503) },
  });

  registry.registerPath({
    method: 'put',
    path: '/tierlist/me',
    summary: 'Guarda mi tier list',
    description: `Reemplaza todos mis votos de la temporada activa (máximo 200 brawlers distintos, tier de 1 a 5; S=5 ... D=1). Límite: 10 por minuto por usuario (429). Sin temporada activa responde 409 NO_ACTIVE_SEASON.${ORIGIN_NOTE}`,
    security: SESSION_SECURITY,
    request: { body: body(SaveTierListBody) },
    responses: { 204: { description: 'Guardada' }, ...errorResponses(400, 401, 403, 409, 429, 503) },
  });
}

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

  registerCommunityPaths(registry);

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
