import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCachedFetch } from '../src/cache/cached-fetch';
import { createMemoryCache } from '../src/cache/memory';
import { createServices, type Services } from '../src/services';
import { createFixtureClient } from '../src/supercell/fixtures';
import type { SupercellApi } from '../src/supercell/types';

let sc: SupercellApi;
let services: Services;

beforeEach(() => {
  sc = createFixtureClient({ slowMs: 5 });
  const { cachedFetch } = createCachedFetch({ cache: createMemoryCache() });
  services = createServices({ supercell: sc, cachedFetch, brawlerMeta: {} });
});

describe('services', () => {
  it('player: fresh y luego cache', async () => {
    expect((await services.player('2PP')).source).toBe('fresh');
    const again = await services.player('2PP');
    expect(again.source).toBe('cache');
    expect(again.data.tag).toBe('2PP');
  });

  it('player inexistente → NOT_FOUND con mensaje específico, también desde la caché negativa', async () => {
    const spy = vi.spyOn(sc, 'getPlayer');
    for (let i = 0; i < 2; i++) {
      await expect(services.player('999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'No existe un jugador con ese tag.',
      });
    }
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('club inexistente → mensaje de club', async () => {
    await expect(services.club('999')).rejects.toMatchObject({ message: 'No existe un club con ese tag.' });
  });

  it('rankings: una sola llamada upstream sirve para distintos limit', async () => {
    const spy = vi.spyOn(sc, 'getPlayerRankings');
    expect((await services.playerRankings('global', 2)).data).toHaveLength(2);
    const r = await services.playerRankings('global', 3);
    expect(r.data).toHaveLength(3);
    expect(r.source).toBe('cache');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('global', 200);
  });

  it('brawler por id sale del catálogo cacheado', async () => {
    const spy = vi.spyOn(sc, 'getBrawlers');
    expect((await services.brawler(16000002)).data.name).toBe('BULL');
    await expect(services.brawler(16000999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'No existe un brawler con ese id.',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('beforeUpstream se llama en un miss y no en un hit', async () => {
    const beforeUpstream = vi.fn();
    await services.eventRotation({ beforeUpstream });
    await services.eventRotation({ beforeUpstream });
    expect(beforeUpstream).toHaveBeenCalledTimes(1);
  });

  it('battleLog, clubRankings, brawlerRankings y brawlers devuelven DTOs', async () => {
    expect((await services.battleLog('2PP')).data).toHaveLength(4);
    expect((await services.clubRankings('global', 50)).data[0]!.tag).toBe('2YPLQ');
    expect((await services.brawlerRankings(16000000, 'global', 1)).data).toHaveLength(1);
    expect((await services.brawlers()).data).toHaveLength(4);
  });
});
