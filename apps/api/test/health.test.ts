import { describe, expect, it } from 'vitest';
import { createMemoryCache } from '../src/cache/memory';
import { createHealth } from '../src/health';
import type { SupercellApi } from '../src/supercell/types';

function live(rejected: boolean): SupercellApi {
  return { mode: 'live', isAuthRejected: () => rejected } as unknown as SupercellApi;
}

describe('createHealth', () => {
  it('reporta unauthorized si Supercell rechazó la key', async () => {
    const health = createHealth({ cache: createMemoryCache(), supercell: live(true), isCoolingDown: async () => false });
    expect((await health()).supercell).toBe('unauthorized');
  });

  it('unauthorized tiene prioridad sobre cooldown', async () => {
    const health = createHealth({ cache: createMemoryCache(), supercell: live(true), isCoolingDown: async () => true });
    expect((await health()).supercell).toBe('unauthorized');
  });

  it('ok cuando la key funciona y no hay cooldown', async () => {
    const health = createHealth({ cache: createMemoryCache(), supercell: live(false), isCoolingDown: async () => false });
    expect((await health()).supercell).toBe('ok');
  });
});
