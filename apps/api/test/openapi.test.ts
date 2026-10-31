import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../src/openapi';
import { createTestApp } from './helpers';

type Op = {
  description?: string;
  security?: unknown[];
  requestBody?: unknown;
  responses: Record<string, { content?: Record<string, { schema: unknown }> }>;
  parameters?: { name: string; in: string }[];
};

const op = (path: string, method: string): Op => {
  const paths = buildOpenApiDocument().paths as Record<string, Record<string, Op>>;
  const found = paths[path]?.[method];
  if (!found) throw new Error(`falta ${method.toUpperCase()} ${path}`);
  return found;
};
const jsonSchema = (o: Op, status: string) => o.responses[status]?.content?.['application/json']?.schema;
const dataOf = (o: Op, status: string) =>
  JSON.stringify((jsonSchema(o, status) as { properties: { data: unknown } }).properties.data);

describe('OpenAPI', () => {
  it('documenta todas las rutas de v1 y de Comunidad', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
      [
        '/auth/discord',
        '/auth/discord/callback',
        '/auth/logout',
        '/brawlers',
        '/brawlers/{id}',
        '/clubs/{tag}',
        '/events/rotation',
        '/health',
        '/me',
        '/me/favorites',
        '/me/favorites/import',
        '/me/favorites/{kind}/{tag}',
        '/players/{tag}',
        '/players/{tag}/battlelog',
        '/rankings/brawlers/{brawlerId}',
        '/rankings/clubs',
        '/rankings/players',
        '/seasons',
        '/tierlist',
        '/tierlist/me',
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

  describe('Comunidad', () => {
    it('expone los métodos de cada ruta', () => {
      const paths = buildOpenApiDocument().paths as Record<string, Record<string, unknown>>;
      const methods = (p: string) => Object.keys(paths[p] ?? {}).sort();
      expect(methods('/auth/discord')).toEqual(['get']);
      expect(methods('/auth/discord/callback')).toEqual(['get']);
      expect(methods('/auth/logout')).toEqual(['post']);
      expect(methods('/me')).toEqual(['delete', 'get', 'patch']);
      expect(methods('/me/favorites')).toEqual(['get']);
      expect(methods('/me/favorites/import')).toEqual(['post']);
      expect(methods('/me/favorites/{kind}/{tag}')).toEqual(['delete', 'put']);
      expect(methods('/seasons')).toEqual(['get', 'post']);
      expect(methods('/tierlist')).toEqual(['get']);
      expect(methods('/tierlist/me')).toEqual(['get', 'put']);
    });

    it('declara la cookie bw_session como esquema de seguridad', () => {
      const schemes = buildOpenApiDocument().components?.securitySchemes as Record<string, unknown>;
      expect(schemes.cookieAuth).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'bw_session' });
    });

    it('marca la autenticación solo donde hace falta', () => {
      for (const [path, method] of [
        ['/auth/logout', 'post'],
        ['/me', 'patch'],
        ['/me', 'delete'],
        ['/me/favorites', 'get'],
        ['/me/favorites/import', 'post'],
        ['/me/favorites/{kind}/{tag}', 'put'],
        ['/me/favorites/{kind}/{tag}', 'delete'],
        ['/seasons', 'post'],
        ['/tierlist/me', 'get'],
        ['/tierlist/me', 'put'],
      ] as const) {
        expect(op(path, method).security, `${method} ${path}`).toEqual([{ cookieAuth: [] }]);
      }
      for (const [path, method] of [
        ['/me', 'get'],
        ['/seasons', 'get'],
        ['/tierlist', 'get'],
        ['/auth/discord', 'get'],
        ['/auth/discord/callback', 'get'],
        ['/health', 'get'],
      ] as const) {
        expect(op(path, method).security, `${method} ${path}`).toBeUndefined();
      }
    });

    it('las respuestas 204 y las redirecciones no llevan contenido', () => {
      for (const [path, method, status] of [
        ['/auth/logout', 'post', '204'],
        ['/me', 'delete', '204'],
        ['/me/favorites/{kind}/{tag}', 'put', '204'],
        ['/me/favorites/{kind}/{tag}', 'delete', '204'],
        ['/tierlist/me', 'put', '204'],
        ['/auth/discord', 'get', '302'],
        ['/auth/discord/callback', 'get', '302'],
      ] as const) {
        const res = op(path, method).responses[status];
        expect(res, `${method} ${path} ${status}`).toBeDefined();
        expect(res?.content, `${method} ${path} ${status}`).toBeUndefined();
      }
      expect(op('/seasons', 'post').responses['201']).toBeDefined();
    });

    it('referencia los esquemas compartidos por nombre de componente', () => {
      const schemas = Object.keys(buildOpenApiDocument().components?.schemas ?? {});
      for (const name of [
        'User',
        'Me',
        'Favorite',
        'Season',
        'CommunityTierList',
        'MyTierList',
        'SaveTierListBody',
        'ImportFavoritesBody',
      ]) {
        expect(schemas).toContain(name);
      }
      const ref = (name: string) => `#/components/schemas/${name}`;
      expect(dataOf(op('/me', 'get'), '200')).toContain(ref('Me'));
      expect(dataOf(op('/me', 'patch'), '200')).toContain(ref('Me'));
      expect(dataOf(op('/me/favorites', 'get'), '200')).toContain(ref('Favorite'));
      expect(dataOf(op('/me/favorites/import', 'post'), '200')).toContain('imported');
      expect(dataOf(op('/seasons', 'get'), '200')).toContain(ref('Season'));
      expect(dataOf(op('/seasons', 'post'), '201')).toContain(ref('Season'));
      expect(dataOf(op('/tierlist', 'get'), '200')).toContain(ref('CommunityTierList'));
      expect(dataOf(op('/tierlist/me', 'get'), '200')).toContain(ref('MyTierList'));
      expect(JSON.stringify(op('/tierlist/me', 'put').requestBody)).toContain(ref('SaveTierListBody'));
      expect(JSON.stringify(op('/me/favorites/import', 'post').requestBody)).toContain(ref('ImportFavoritesBody'));
    });

    it('GET /seasons y GET /me/favorites devuelven un arreglo en data', () => {
      for (const path of ['/seasons', '/me/favorites']) {
        const schema = jsonSchema(op(path, 'get'), '200') as { properties: { data: { type: string } } };
        expect(schema.properties.data.type).toBe('array');
      }
    });

    it('documenta los parámetros de ruta y consulta', () => {
      const params = (path: string, method: string) =>
        (op(path, method).parameters ?? []).map((p) => `${p.in}:${p.name}`).sort();
      expect(params('/me/favorites/{kind}/{tag}', 'put')).toEqual(['path:kind', 'path:tag']);
      expect(params('/me/favorites/{kind}/{tag}', 'delete')).toEqual(['path:kind', 'path:tag']);
      expect(params('/tierlist', 'get')).toEqual(['query:season']);
      expect(params('/auth/discord', 'get')).toEqual(['query:next']);
    });

    it('documenta los errores con su estado', () => {
      const has = (path: string, method: string, ...statuses: string[]) => {
        const o = op(path, method);
        for (const status of statuses) {
          expect(o.responses[status], `${method} ${path} ${status}`).toBeDefined();
          expect(JSON.stringify(jsonSchema(o, status))).toContain('requestId');
        }
      };
      has('/auth/logout', 'post', '401', '403', '503');
      has('/me', 'get', '503');
      has('/me', 'patch', '400', '401', '403', '503');
      has('/me', 'delete', '401', '403', '503');
      has('/me/favorites', 'get', '401', '503');
      has('/me/favorites/{kind}/{tag}', 'put', '400', '401', '403', '503');
      has('/me/favorites/{kind}/{tag}', 'delete', '400', '401', '403', '503');
      has('/me/favorites/import', 'post', '400', '401', '403', '503');
      has('/seasons', 'get', '503');
      has('/seasons', 'post', '400', '403', '404', '503');
      has('/tierlist', 'get', '400', '404', '503');
      has('/tierlist/me', 'get', '401', '409', '503');
      has('/tierlist/me', 'put', '400', '401', '403', '409', '429', '503');
    });

    it('fija en las descripciones las reglas del contrato', () => {
      const text = (path: string, method: string) => op(path, method).description ?? '';
      expect(text('/seasons', 'post')).toContain('404');
      expect(text('/seasons', 'post')).toContain('201');
      expect(text('/seasons', 'get')).toContain('arreglo');
      expect(text('/me/favorites', 'get')).toContain('arreglo');
      expect(text('/tierlist', 'get')).toContain('2 decimales');
      expect(text('/tierlist', 'get')).not.toContain('1 decimal');
      expect(text('/tierlist', 'get')).toContain('4.495');
      expect(text('/tierlist', 'get')).toContain('4.50');
      expect(text('/tierlist', 'get')).toContain('Pocos votos');
      expect(text('/tierlist/me', 'put')).toContain('10 por minuto');
      expect(text('/tierlist/me', 'get')).toContain('NO_ACTIVE_SEASON');
      expect(text('/me/favorites/{kind}/{tag}', 'put')).toContain('Origin');
    });

    it('/health documenta db', () => {
      const schema = JSON.stringify(jsonSchema(op('/health', 'get'), '200'));
      expect(schema).toContain('"db"');
      expect(schema).toContain('disabled');
    });
  });
});
