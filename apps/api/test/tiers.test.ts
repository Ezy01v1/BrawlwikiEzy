import { describe, expect, it } from 'vitest';
import { aggregate, MIN_RATED_PER_USER, MIN_VOTES, tierFor } from '../src/community/tiers';

describe('tierFor', () => {
  it('cortes S ≥ 4.5, A ≥ 3.5, B ≥ 2.5, C ≥ 1.5, D por debajo', () => {
    expect(tierFor(5, 5)).toBe('S');
    expect(tierFor(4.5, 5)).toBe('S');
    expect(tierFor(4.49, 5)).toBe('A');
    expect(tierFor(3.5, 5)).toBe('A');
    expect(tierFor(3.49, 5)).toBe('B');
    expect(tierFor(2.5, 5)).toBe('B');
    expect(tierFor(2.49, 5)).toBe('C');
    expect(tierFor(1.5, 5)).toBe('C');
    expect(tierFor(1.49, 9)).toBe('D');
    expect(tierFor(1, 100)).toBe('D');
  });

  it('con menos de 5 votos no hay tier', () => {
    expect(MIN_VOTES).toBe(5);
    expect(tierFor(5, 4)).toBeNull();
    expect(tierFor(1, 0)).toBeNull();
    expect(tierFor(5, 5)).toBe('S');
  });
});

/** Un usuario que ubica `count` brawlers (ids 1..count) todos con el mismo tier. */
function user(userId: number, count: number, tier: number, firstId = 1) {
  return Array.from({ length: count }, (_, i) => ({ userId, brawlerId: firstId + i, tier }));
}

describe('aggregate', () => {
  it('sin filas → 0 votantes, sin filas', () => {
    expect(aggregate([])).toEqual({ voters: 0, rows: [] });
  });

  it('ignora a un usuario con 9 votos y cuenta a uno con 10', () => {
    expect(MIN_RATED_PER_USER).toBe(10);
    const r = aggregate([...user(1, 9, 5), ...user(2, 10, 1)]);
    expect(r.voters).toBe(1);
    expect(r.rows).toHaveLength(10);
    for (const row of r.rows) expect(row).toMatchObject({ average: 1, votes: 1, tier: null });
  });

  it('promedia por brawler, redondea a 2 decimales y asigna tier con ≥ 5 votos', () => {
    // 6 usuarios ubican los brawlers 1..10; para el brawler 1 votan 5,5,5,4,4,4 → 4.5 → S.
    const rows = [1, 2, 3, 4, 5, 6].flatMap((u) => user(u, 10, 3));
    for (const r of rows) if (r.brawlerId === 1) r.tier = r.userId <= 3 ? 5 : 4;
    // Brawler 2: 5,4,4,4,4,4 → 4.1666… → 4.17 → A.
    for (const r of rows) if (r.brawlerId === 2) r.tier = r.userId === 1 ? 5 : 4;
    const out = aggregate(rows);
    expect(out.voters).toBe(6);
    expect(out.rows[0]).toEqual({ brawlerId: 1, tier: 'S', average: 4.5, votes: 6 });
    expect(out.rows[1]).toEqual({ brawlerId: 2, tier: 'A', average: 4.17, votes: 6 });
    expect(out.rows[2]).toEqual({ brawlerId: 3, tier: 'B', average: 3, votes: 6 });
  });

  it('el tier sale del promedio redondeado (4.495 → 4.5 → S)', () => {
    // 200 usuarios con 10 votos; para el brawler 1: 99 votan 5 y 101 votan 4 → 4.495.
    const rows = Array.from({ length: 200 }, (_, i) => i + 1).flatMap((u) => user(u, 10, 3));
    for (const r of rows) if (r.brawlerId === 1) r.tier = r.userId <= 99 ? 5 : 4;
    const first = aggregate(rows).rows[0];
    expect(first).toEqual({ brawlerId: 1, tier: 'S', average: 4.5, votes: 200 });
  });

  it('4 votos → tier null; 5 votos → tier', () => {
    const four = [1, 2, 3, 4].flatMap((u) => user(u, 10, 5));
    expect(aggregate(four).rows.every((r) => r.tier === null && r.votes === 4)).toBe(true);
    const five = [1, 2, 3, 4, 5].flatMap((u) => user(u, 10, 5));
    expect(aggregate(five).rows.every((r) => r.tier === 'S' && r.votes === 5)).toBe(true);
  });

  it('ordena por promedio desc y, a igual promedio, por brawlerId asc', () => {
    const rows = [...user(1, 10, 2, 100), ...user(2, 10, 2, 100)];
    for (const r of rows) if (r.brawlerId === 105) r.tier = 5;
    for (const r of rows) if (r.brawlerId === 109) r.tier = 1;
    const ids = aggregate(rows).rows.map((r) => r.brawlerId);
    expect(ids).toEqual([105, 100, 101, 102, 103, 104, 106, 107, 108, 109]);
  });

  it('los votos descartados no cuentan en el promedio de nadie', () => {
    // El usuario 9 ubica 9 brawlers con 5; el brawler 1 solo debe promediar a los usuarios válidos.
    const rows = [...[1, 2, 3, 4, 5].flatMap((u) => user(u, 10, 1)), ...user(9, 9, 5)];
    const b1 = aggregate(rows).rows.find((r) => r.brawlerId === 1);
    expect(b1).toEqual({ brawlerId: 1, tier: 'D', average: 1, votes: 5 });
  });
});
