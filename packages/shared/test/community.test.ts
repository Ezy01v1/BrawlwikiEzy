import { describe, expect, it } from 'vitest';
import {
  ErrorCodeSchema,
  ImportFavoritesBodySchema,
  MeSchema,
  SaveTierListBodySchema,
} from '../src/schemas';

describe('community contract', () => {
  it('SaveTierListBody rejects tier 6, 0 and duplicate brawlerId', () => {
    expect(SaveTierListBodySchema.safeParse({ votes: [{ brawlerId: 1, tier: 6 }] }).success).toBe(false);
    expect(SaveTierListBodySchema.safeParse({ votes: [{ brawlerId: 1, tier: 0 }] }).success).toBe(false);
    expect(
      SaveTierListBodySchema.safeParse({ votes: [{ brawlerId: 1, tier: 3 }, { brawlerId: 1, tier: 4 }] }).success,
    ).toBe(false);
    expect(SaveTierListBodySchema.safeParse({ votes: [{ brawlerId: 1, tier: 5 }] }).success).toBe(true);
  });
  it('ImportFavoritesBody rejects 101 items', () => {
    const item = { kind: 'player', tag: '2PP', name: 'x' };
    expect(ImportFavoritesBodySchema.safeParse({ items: Array(100).fill(item) }).success).toBe(true);
    expect(ImportFavoritesBodySchema.safeParse({ items: Array(101).fill(item) }).success).toBe(false);
  });
  it('MeSchema accepts null user', () => {
    expect(MeSchema.safeParse({ user: null }).success).toBe(true);
  });
  it('ErrorCodeSchema accepts new codes', () => {
    for (const c of ['UNAUTHENTICATED', 'FORBIDDEN', 'NO_ACTIVE_SEASON', 'DB_UNAVAILABLE'])
      expect(ErrorCodeSchema.safeParse(c).success).toBe(true);
  });
});
