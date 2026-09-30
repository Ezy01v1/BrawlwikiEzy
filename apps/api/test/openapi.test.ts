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
