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
