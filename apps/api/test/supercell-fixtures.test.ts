import { describe, expect, it } from 'vitest';
import { createFixtureClient } from '../src/supercell/fixtures';

describe('createFixtureClient', () => {
  const c = createFixtureClient({ slowMs: 15 });

  it('mode es mock', () => {
    expect(c.mode).toBe('mock');
  });

  it('devuelve jugadores y clubes conocidos', async () => {
    expect((await c.getPlayer('2PP')).name).toBe('EzyPlayer');
    expect((await c.getPlayer('8QU')).club).toEqual({});
    expect((await c.getClub('2YPLQ')).name).toBe('Los Cracks');
    expect((await c.getClub('8CGRV')).name).toBe('Titanes');
  });

  it('battle log de 2PP tiene 4 partidas y el de 8QU está vacío', async () => {
    expect((await c.getBattleLog('2PP')).items).toHaveLength(4);
    expect((await c.getBattleLog('8QU')).items).toEqual([]);
  });

  it('tag desconocido → NOT_FOUND', async () => {
    await expect(c.getPlayer('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(c.getClub('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('escenarios RRRR y LLLL', async () => {
    await expect(c.getPlayer('RRRR')).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED', retryAfter: 10 });
    await expect(c.getClub('LLLL')).rejects.toMatchObject({ code: 'UPSTREAM_MAINTENANCE' });
  });

  it('GGGG responde como 2PP pero tras slowMs', async () => {
    const t0 = Date.now();
    const p = await c.getPlayer('GGGG');
    expect(Date.now() - t0).toBeGreaterThanOrEqual(14);
    expect(p.tag).toBe('#GGGG');
  });

  it('rankings, brawlers y eventos', async () => {
    expect((await c.getPlayerRankings('MX', 50)).items).toHaveLength(3);
    expect((await c.getBrawlerRankings('global', 16000000, 50)).items).toHaveLength(3);
    expect((await c.getClubRankings('global', 50)).items).toHaveLength(2);
    expect((await c.getBrawlers()).items).toHaveLength(4);
    expect(await c.getEventRotation()).toHaveLength(2);
  });
});
