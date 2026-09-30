import { describe, expect, it } from 'vitest';
import { convertBrawlifyBrawlers, getBrawlerMeta, loadBrawlerMeta } from '../src/assets/brawler-meta';
import { brawlerImageUrl, clubBadgeUrl, mapImageUrl, profileIconUrl } from '../src/assets/urls';

describe('urls del CDN', () => {
  it('siguen los patrones verificados', () => {
    expect(brawlerImageUrl(16000000)).toBe('https://cdn.brawlify.com/brawlers/borderless/16000000.png');
    expect(profileIconUrl(28000000)).toBe('https://cdn.brawlify.com/profile-icons/regular/28000000.png');
    expect(mapImageUrl(15000026)).toBe('https://cdn.brawlify.com/maps/regular/15000026.png');
    expect(clubBadgeUrl(8000000)).toBe('https://cdn.brawlify.com/club-badges/regular/8000000.png');
  });

  it('mapa sin id → null', () => {
    expect(mapImageUrl(0)).toBeNull();
    expect(mapImageUrl(undefined)).toBeNull();
    expect(mapImageUrl(null)).toBeNull();
  });
});

describe('brawler meta', () => {
  const map = { '16000001': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Damage Dealer' } };

  it('devuelve la meta conocida', () => {
    expect(getBrawlerMeta(16000001, map)).toEqual(map['16000001']);
  });

  it('brawler desconocido → rarity y class null', () => {
    expect(getBrawlerMeta(16000999, map)).toEqual({ rarity: null, class: null });
  });

  it('loadBrawlerMeta lee el JSON del repo', () => {
    expect(typeof loadBrawlerMeta()).toBe('object');
  });

  it('convertBrawlifyBrawlers convierte la forma de Brawlify /v1/brawlers', () => {
    const json = {
      list: [
        { id: 16000001, name: 'Colt', rarity: { id: 2, name: 'Rare', color: '#68fd58' }, class: { id: 2, name: 'Damage Dealer' } },
        { id: 16000099, name: 'Nuevo', rarity: null, class: null },
        { name: 'sin id' },
      ],
    };
    expect(convertBrawlifyBrawlers(json)).toEqual({
      '16000001': { rarity: { name: 'Rare', color: '#68fd58' }, class: 'Damage Dealer' },
      '16000099': { rarity: null, class: null },
    });
  });

  it('convertBrawlifyBrawlers rechaza JSON con otra forma', () => {
    expect(() => convertBrawlifyBrawlers({ items: [] })).toThrow('{ list: [...] }');
  });
});
